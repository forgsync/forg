import { Person } from '../repo/git';

export function dummyPerson(): Person {
  return {
    name: 'Test Name',
    email: 'test@example.com',
    date: {
      seconds: 2272247100,
      offset: 180,
    },
  };
}
