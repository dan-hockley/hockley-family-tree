import { useState, useEffect } from 'react';
import { loadGedcom } from './lib/gedcom';
import type { Person, PersonDetail } from './types';
import FamilyTree from './components/FamilyTree';

export default function App() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [details, setDetails] = useState<Map<string, PersonDetail>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGedcom('/hockley-2024.ged')
      .then(({ persons, details }) => {
        setPersons(persons);
        setDetails(details);
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="text-2xl mb-2">🌳</div>
          <div className="text-slate-400 text-sm">Loading tree...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-red-400">
        <div className="text-center max-w-md">
          <div className="text-lg font-semibold mb-2">Failed to load GEDCOM</div>
          <div className="text-sm font-mono bg-slate-800 p-3 rounded">{error}</div>
        </div>
      </div>
    );
  }

  return <FamilyTree persons={persons} details={details} />;
}
