import type { Person, PersonDetail, LifeEvent } from '../types';

// GEDCOM tags we treat as life events
const EVENT_TAGS = new Set([
  'BIRT','DEAT','BURI','BAPM','MARR','DIV','EMIG','IMMI','NATU',
  'CENS','RESI','EVEN','OCCU','EDUC','GRAD','MILI','PROB','WILL',
  'ADOP','CHR','CONF','FCOM',
]);

function parseName(raw: string): { givenName: string; surname: string; full: string } {
  const match = raw.match(/^(.*?)\/(.*)\/(.*)$/);
  if (match) {
    const givenName = (match[1] + match[3]).trim();
    const surname = match[2].trim();
    return { givenName, surname, full: `${givenName} ${surname}`.trim() };
  }
  return { givenName: raw.trim(), surname: '', full: raw.trim() };
}

function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^(ABT|CAL|EST|BEF|AFT)\s+/i, '~').trim() || undefined;
}

// Decode common HTML entities that Ancestry leaves in NOTE fields
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

export async function loadGedcom(
  url: string
): Promise<{ persons: Person[]; details: Map<string, PersonDetail> }> {
  const text = await fetch(url).then(r => r.text());

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  type GedRecord = { level: number; xref?: string; tag: string; value: string };
  const records: GedRecord[] = lines.map(line => {
    const m = line.match(/^(\d+)\s+(@[^@]+@)?\s*(\w+)\s*(.*)?$/);
    if (!m) return null;
    return {
      level: parseInt(m[1]),
      xref: m[2]?.trim(),
      tag: m[3].trim(),
      value: (m[4] || '').trim(),
    };
  }).filter(Boolean) as GedRecord[];

  // Raw storage keyed by GEDCOM id
  interface RawIndi {
    fields: Record<string, unknown>;
    events: RawEvent[];
    notes: string[];
  }
  interface RawEvent {
    type: string;
    date?: string;
    place?: string;
    description?: string;
    notes: string[];
    sources: string[];
    // track current sub-tag for CONT lines
    _lastSubTag?: string;
  }

  const individuals: Record<string, RawIndi> = {};
  const families: Record<string, { husb?: string; wife?: string; chil: string[] }> = {};
  // Source titles by id
  const sources: Record<string, string> = {};

  let currentType = '';
  let currentId = '';
  let currentEvent: RawEvent | null = null;
  let pendingLevel1Tag = '';
  let pendingNoteLines: string[] = [];
  let inNote = false;

  for (const rec of records) {
    if (rec.level === 0) {
      // Flush pending note
      if (inNote && currentId && individuals[currentId]) {
        individuals[currentId].notes.push(decodeEntities(pendingNoteLines.join('').trim()));
      }
      pendingNoteLines = [];
      inNote = false;
      currentEvent = null;
      pendingLevel1Tag = '';

      currentId = rec.xref || '';
      currentType = rec.tag;

      if (currentType === 'INDI' && currentId) {
        individuals[currentId] = { fields: {}, events: [], notes: [] };
      }
      if (currentType === 'FAM' && currentId) {
        families[currentId] = { chil: [] };
      }
      if (currentType === 'SOUR' && currentId) {
        sources[currentId] = '';
      }
      continue;
    }

    // Source title
    if (currentType === 'SOUR' && rec.level === 1 && rec.tag === 'TITL') {
      sources[currentId] = rec.value;
      continue;
    }

    if (currentType === 'INDI' && currentId) {
      const indi = individuals[currentId];

      if (rec.level === 1) {
        // Flush pending multi-line note
        if (inNote) {
          indi.notes.push(decodeEntities(pendingNoteLines.join('').trim()));
          pendingNoteLines = [];
          inNote = false;
        }
        currentEvent = null;
        pendingLevel1Tag = rec.tag;

        if (EVENT_TAGS.has(rec.tag)) {
          currentEvent = {
            type: rec.tag,
            description: rec.value && rec.value !== 'Y' ? rec.value : undefined,
            notes: [],
            sources: [],
          };
          indi.events.push(currentEvent);
        } else if (rec.tag === 'NOTE') {
          inNote = true;
          pendingNoteLines = [rec.value];
        } else {
          // Simple field (NAME, SEX, FAMC, FAMS, etc.)
          if (!indi.fields[rec.tag]) {
            indi.fields[rec.tag] = rec.value || {};
          } else if (!Array.isArray(indi.fields[rec.tag])) {
            indi.fields[rec.tag] = [indi.fields[rec.tag] as unknown, rec.value || {}];
          } else {
            (indi.fields[rec.tag] as unknown[]).push(rec.value || {});
          }
        }
        continue;
      }

      if (rec.level === 2) {
        if (inNote) {
          if (rec.tag === 'CONT') {
            pendingNoteLines.push('\n' + rec.value);
          } else if (rec.tag === 'CONC') {
            pendingNoteLines.push(rec.value);
          }
          continue;
        }

        if (currentEvent) {
          currentEvent._lastSubTag = rec.tag;
          if (rec.tag === 'DATE') currentEvent.date = parseDate(rec.value);
          else if (rec.tag === 'PLAC') currentEvent.place = rec.value;
          else if (rec.tag === 'TYPE') currentEvent.description = rec.value;
          else if (rec.tag === 'NOTE') currentEvent.notes.push(decodeEntities(rec.value));
          else if (rec.tag === 'SOUR') currentEvent.sources.push(rec.value);
          continue;
        }

        // Nested field under level-1 tag (e.g. BIRT.DATE handled via currentEvent above)
        if (pendingLevel1Tag) {
          const parent = indi.fields[pendingLevel1Tag];
          if (parent && typeof parent === 'object' && !Array.isArray(parent)) {
            (parent as Record<string, string>)[rec.tag] = rec.value;
          }
        }
        continue;
      }

      if (rec.level === 3) {
        // Source title under event citation
        if (currentEvent && currentEvent._lastSubTag === 'SOUR' && rec.tag === 'PAGE') {
          // page info — ignore for now
        }
      }
    } else if (currentType === 'FAM' && currentId) {
      const fam = families[currentId];
      if (rec.level === 1) {
        if (rec.tag === 'HUSB') fam.husb = rec.value;
        else if (rec.tag === 'WIFE') fam.wife = rec.value;
        else if (rec.tag === 'CHIL') fam.chil.push(rec.value);
      }
    }
  }

  // Flush any trailing note
  for (const [id, indi] of Object.entries(individuals)) {
    if (inNote && id === currentId) {
      indi.notes.push(decodeEntities(pendingNoteLines.join('').trim()));
    }
  }

  // Build Person objects
  const persons: Person[] = [];
  const details = new Map<string, PersonDetail>();

  for (const [id, indi] of Object.entries(individuals)) {
    const rawName = typeof indi.fields['NAME'] === 'string' ? indi.fields['NAME'] : '';
    const { givenName, surname, full } = parseName(rawName);

    const birt = indi.events.find(e => e.type === 'BIRT');
    const deat = indi.events.find(e => e.type === 'DEAT');

    const famcRaw = indi.fields['FAMC'];
    const famsRaw = indi.fields['FAMS'];
    const famcIds: string[] = Array.isArray(famcRaw) ? famcRaw as string[] : famcRaw ? [famcRaw as string] : [];
    const famsIds: string[] = Array.isArray(famsRaw) ? famsRaw as string[] : famsRaw ? [famsRaw as string] : [];

    persons.push({
      id,
      name: full || 'Unknown',
      givenName: givenName || undefined,
      surname,
      sex: (indi.fields['SEX'] as string) === 'M' ? 'M' : (indi.fields['SEX'] as string) === 'F' ? 'F' : 'U',
      birthDate: birt?.date,
      birthPlace: birt?.place,
      deathDate: deat?.date,
      deathPlace: deat?.place,
      fatherIds: [],
      motherIds: [],
      childIds: [],
      spouseIds: [],
      _famcIds: famcIds,
      _famsIds: famsIds,
    } as Person & { _famcIds: string[]; _famsIds: string[] });

    // Build detail: deduplicate birth/death (already in Person), keep all events
    const lifeEvents: LifeEvent[] = indi.events.map(e => ({
      type: e.type,
      date: e.date,
      place: e.place,
      description: e.description,
      notes: e.notes.length > 0 ? e.notes : undefined,
      sources: e.sources.length > 0 ? e.sources : undefined,
    }));

    details.set(id, {
      id,
      events: lifeEvents,
      notes: indi.notes.filter(Boolean),
    });
  }

  // Resolve family relationships
  const personMap = new Map(persons.map(p => [p.id, p]));

  for (const person of persons) {
    const p = person as Person & { _famcIds: string[]; _famsIds: string[] };

    for (const famId of p._famcIds) {
      const fam = families[famId];
      if (!fam) continue;
      if (fam.husb) {
        const father = personMap.get(fam.husb);
        if (father) {
          p.fatherIds.push(fam.husb);
          if (!father.childIds.includes(p.id)) father.childIds.push(p.id);
        }
      }
      if (fam.wife) {
        const mother = personMap.get(fam.wife);
        if (mother) {
          p.motherIds.push(fam.wife);
          if (!mother.childIds.includes(p.id)) mother.childIds.push(p.id);
        }
      }
    }

    for (const famId of p._famsIds) {
      const fam = families[famId];
      if (!fam) continue;
      const spouseId = p.sex === 'M' ? fam.wife : fam.husb;
      if (spouseId && !p.spouseIds.includes(spouseId)) {
        p.spouseIds.push(spouseId);
      }
    }

    delete (p as unknown as Record<string, unknown>)._famcIds;
    delete (p as unknown as Record<string, unknown>)._famsIds;
  }

  return { persons, details };
}
