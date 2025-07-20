interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface TimeRecord {
  id: string;
  type: 'in' | 'out';
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  location_id: string | null;
  user_id: string;
  profiles?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

// Utility for handling browser-specific exports
export const exportTimeRecords = async (
  data: TimeRecord[], 
  filename: string, 
  locations: Location[] = []
) => {
  if (typeof window === 'undefined') {
    throw new Error('Export functionality is only available in browser environment');
  }

  const csvContent = [
    'User,Email,Type,Date,Time,Location,Coordinates',
    ...data.map(record => {
      const user = record.profiles;
      const userName = user?.first_name && user?.last_name 
        ? `${user.first_name} ${user.last_name}`
        : user?.email || 'Unknown';
      const location = record.location_id 
        ? locations.find(l => l.id === record.location_id)?.name || 'Unknown'
        : 'Remote';
      const coords = record.latitude && record.longitude 
        ? `"${record.latitude}, ${record.longitude}"`
        : '';
      
      return [
        `"${userName}"`,
        user?.email || '',
        record.type.toUpperCase(),
        new Date(record.timestamp).toLocaleDateString(),
        new Date(record.timestamp).toLocaleTimeString(),
        location,
        coords
      ].join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const exportUserTimeRecords = async (
  records: TimeRecord[],
  locations: Location[] = []
) => {
  const filename = `time_records_${new Date().toISOString().split('T')[0]}.csv`;
  return exportTimeRecords(records, filename, locations);
};