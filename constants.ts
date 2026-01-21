
import { PCPart, PCPartStatus, GameLocation } from './types';

export const INITIAL_PARTS: PCPart[] = [
  {
    id: 'motherboard',
    name: 'Motherboard',
    description: 'The "Base" - Connects all other components.',
    location: 'Main Office',
    status: PCPartStatus.MISSING,
    order: 1
  },
  {
    id: 'cpu-ram',
    name: 'CPU & RAM',
    description: 'The "Brain" - Processing and short-term memory.',
    location: 'High-End Lab',
    status: PCPartStatus.MISSING,
    order: 2
  },
  {
    id: 'gpu',
    name: 'GPU',
    description: 'The "Vision" - Handles high-fidelity rendering.',
    location: 'Graphic Design Wing',
    status: PCPartStatus.MISSING,
    order: 3
  },
  {
    id: 'psu',
    name: 'PSU',
    description: 'The "Power" - Distributes electricity.',
    location: 'Boiler/Server Room',
    status: PCPartStatus.MISSING,
    order: 4
  }
];

export const LOCATIONS: GameLocation[] = [
  {
    id: 'main-office',
    name: 'Main Office',
    horrorLevel: 2,
    description: 'A quiet place of bureaucracy, now echoing with faint typing sounds.',
    imageUrl: 'https://picsum.photos/seed/office/800/400'
  },
  {
    id: 'lab',
    name: 'High-End Lab',
    horrorLevel: 5,
    description: 'Rows of glowing towers. Some screens show data you do not recognize.',
    imageUrl: 'https://picsum.photos/seed/lab/800/400'
  },
  {
    id: 'design-wing',
    name: 'Graphic Design Wing',
    horrorLevel: 7,
    description: 'Drapey shadows and giant plotters that move without power.',
    imageUrl: 'https://picsum.photos/seed/design/800/400'
  },
  {
    id: 'server-room',
    name: 'Boiler / Server Room',
    horrorLevel: 9,
    description: 'The hum is deafening. The heat is unbearable. Something clicks in the dark.',
    imageUrl: 'https://picsum.photos/seed/server/800/400'
  }
];
