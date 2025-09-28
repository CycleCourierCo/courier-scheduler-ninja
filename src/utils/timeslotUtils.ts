/**
 * Formats a timeslot time into a 3-hour window range
 * @param time - Time string in HH:MM format
 * @returns Formatted time range string (e.g. "15:00 to 18:00")
 */
export const formatTimeslotWindow = (time: string): string => {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':').map(Number);
  const endHour = Math.min(23, hours + 3);
  const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const endTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return `${startTime} to ${endTime}`;
};