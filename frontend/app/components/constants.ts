// constants.ts

export type id = string; // Define 'id' as a string for this example.

import type { Note, Measure } from './NoteEditor'

// Define the Duration type
export type Duration = 1 | 2 | 4 | 8 | 16 | 32; // Example values for note durations (1 = 16th note, 2 = 8th note, etc.)

// Create initialMeasures variable with 16 measures and random notes
const measures: Measure[] = Array.from({ length: 16 }, (_, index) => ({ id: `m${index + 1}`, number: index + 1 }));

const generateRandomPitch = (): string => {
    const pitches = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C#4', 'D#4', 'F#4', 'G#4', 'A#4', 'Db3', 'Eb3'];
    return pitches[Math.floor(Math.random() * pitches.length)];
};

const notes: Note[] = measures.flatMap(measure => 
    Array.from({ length: 4 }, (_, order) => ({
        id: `n${measure.number}-${order + 1}`,
        measure: measure.id,
        order: order + 1,
        pitch: generateRandomPitch(),
        duration: 16,  // Example duration (16th note)
        flourish: null,
        initialized: false
    }))
);

// Create the initialMeasures variable
export const initialMeasures: [Measure[], Note[]] = [measures, notes];
