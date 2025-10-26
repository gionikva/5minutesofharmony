import React from "react";
import StaffNoteEditor from "../components/NoteEditor";
import type { Measure, Note } from "../components/NoteEditor";

const demoMeasures: Measure[] = [
    {
        id: "m0",
        notes: [
            { id: "n0", measure: 0, tick: 0, degree: 0, duration: "quarter", accidental: null },
            { id: "n1", measure: 0, tick: 4, degree: 2, duration: "quarter", accidental: "sharp" },
        ],
    },
    {
        id: "m1",
        notes: [
            { id: "n2", measure: 1, tick: 0, degree: 4, duration: "half", accidental: null },
            { id: "n3", measure: 1, tick: 8, degree: 6, duration: "quarter", accidental: "flat" },
        ],
    },
    {
        id: "m2",
        notes: [
            { id: "n4", measure: 2, tick: 2, degree: -1, duration: "eighth", accidental: null },
        ],
    },
];

export default function DemoNoteEditor() {
    return (
        <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">NoteEditor demo: test measures</h2>
            <StaffNoteEditor width={1100} height={420} initialMeasures={demoMeasures} />
        </div>
    );
}
