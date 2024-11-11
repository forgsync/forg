import { Person } from '../git';

export function dummyPerson(timeIncrement: number = 0): Person {
  return {
    name: 'Test Name',
    email: 'test@example.com',
    date: {
      seconds: 2272247100 + timeIncrement,
      offset: 180,
    },
  };
}
