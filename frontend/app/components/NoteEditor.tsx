import React, { useEffect, useRef } from "react";
import { Stave, StaveNote, Voice, Formatter, Renderer } from "vexflow";
export type Duration = 1 | 2 | 4 | 8 | 16;
export type id = any;
export interface Note {
    id: id;
    measure: id; // id of the measure that it's in
    order: number; // this note's order within the measure
    pitch: string; // Should be something like: C#4, db3
    duration: Duration;  // 1 is a 16th note
    flourish: Record<string, boolean> | null;
    initialized: boolean; // True if the note has been changed previously
}

export type Measure = {
    id: id;
    number: number;
};

export type MeasureWithNotes = {
    measure: Measure;
    notes: Note[];
};

interface StaffNoteEditorProps {
    width?: number;
    height?: number;
    initialMeasures?: [Array<Measure>, Array<Note>]; // Takes in an array of measures and an array of notes
    onChange?: (notes: Note[]) => void;
}

export function noteToEasyScoreNote(n: Note): StaveNote {
    return new StaveNote({
        keys: [n.pitch.replace(/([a-gA-G])(#|b)?(\d)/, "$1$2/$3")], // Add a / between the pitch and octave
        duration: n.duration.toString()
    })
}

export function initialMeasuresToNotes(initialMeasures: [Array<Measure>, Array<Note>]): MeasureWithNotes[] {
    var sorted_measures = initialMeasures[0].sort((a, b) => a.number - b.number);
    var sorted_notes = initialMeasures[1].sort((a, b) => a.order - b.order);

    return sorted_measures.map(measure => ({
        measure,
        notes: sorted_notes.filter(note => note.measure === measure.id)
    }));
}

export default function StaffNoteEditor({ width = 900, height = 240, initialMeasures, onChange }: StaffNoteEditorProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

        useEffect(() => {
            let mounted = true;
            let renderer: any = null;

            if (containerRef.current) {
                renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
                renderer.resize(width, height);
                const context = renderer.getContext();
                const stave = new Stave(10, 40, width - 20);
                stave.addClef("treble").addTimeSignature("4/4");
                const voice = new Voice();
                voice.setStrict(false);

                const orderedNotes = Array<StaveNote>();
                if (initialMeasures) {
                    const measuresWithNotes = initialMeasuresToNotes(initialMeasures);
                    measuresWithNotes.forEach(({ measure, notes }) => {
                        notes.forEach(note => {
                            const staveNote = noteToEasyScoreNote(note);
                            orderedNotes.push(staveNote);
                        });
                    });
                }

                voice.addTickables(orderedNotes);
                // Format and justify the notes to 400 pixels.
                new Formatter().joinVoices([voice]).format([voice], 350);

                voice.draw(context, stave);
            }
        }, [width, height, initialMeasures]);

        return (
            <div>
                <div ref={containerRef} />
            </div>
        );
}