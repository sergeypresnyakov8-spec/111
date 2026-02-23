import { SCRIPT_URL } from '../constants';
import { User } from '../types';

export const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getUsers`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
};

export const fetchSchedule = async (month: string): Promise<any[]> => {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getSchedule&month=${month}`);
    const data = await response.json();
    return data && !data.error ? data : [];
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
    return [];
  }
};
