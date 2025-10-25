import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * StaffNoteEditor
 * A single-file React + TypeScript component that lets you add musical notes to a treble staff by clicking.
 * - Click anywhere on/near the staff to add a note snapped to the nearest staff position and time grid.
 * - Choose duration (whole/half/quarter/eighth) and accidental (♮/♯/♭) from the toolbar.
 * - Click a note to select it. Press Delete/Backspace or use the Trash button to remove.
 * - Drag horizontally to reposition time; Shift+Drag vertically to change pitch.
 * - Optional: Play button uses a simple WebAudio sine tone to audition notes in order.
 *
 * No external libraries are required. Tailwind classes are used for basic styling; remove or replace as desired.
 */

// === Types ===

type Duration = "whole" | "half" | "quarter" | "eighth";

type Accidental = "natural" | "sharp" | "flat" | null;

interface Note {
    id: string;
    x: number; // x position in SVG pixels (snapped to grid)
    degree: number; // staff degree relative to E4 on the bottom line (E4 = 0, F4 = 1, G4 = 2, ...)
    duration: Duration;
    accidental: Accidental;
}

interface StaffNoteEditorProps {
    width?: number;
    height?: number;
    beatWidth?: number; // pixel width for a beat/grid step
    nRows?: number;
    onChange?: (notes: ExportedNote[]) => void;
}

// Public export format (friendly names)
export interface ExportedNote {
    id: string;
    pitch: string; // e.g., "C4", "F#5", "Bb4"
    midi: number; // 60 = C4
    duration: Duration;
    x: number;
}

// === Helpers: music theory-ish mapping ===

// Base reference: degree 0 = E4 (bottom line of treble staff)
const DEGREE_BASE_NOTE = { step: "E" as const, octave: 4 };
const STEPS: Array<"C" | "D" | "E" | "F" | "G" | "A" | "B"> = [
    "C",
    "D",
    "E",
    "F",
    "G",
    "A",
    "B",
];

// Natural semitone offsets from C
const SEMIS_FROM_C: Record<(typeof STEPS)[number], number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};

function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

function degreeToStepOctave(degree: number) {
    // Convert a staff degree (E4 = 0) to diatonic step & octave
    const startIndex = STEPS.indexOf(DEGREE_BASE_NOTE.step); // index of E
    const absoluteIndex = startIndex + degree;
    const step = STEPS[mod(absoluteIndex, 7)];
    const octaveDelta = Math.floor((startIndex + degree) / 7);
    const octave = DEGREE_BASE_NOTE.octave + octaveDelta;
    return { step, octave };
}

function stepOctaveToMidi(step: (typeof STEPS)[number], octave: number, acc: Accidental): number {
    // MIDI 60 = C4
    const naturalSemis = SEMIS_FROM_C[step];
    const accidentalOffset = acc === "sharp" ? 1 : acc === "flat" ? -1 : 0;
    const semisFromC0 = naturalSemis + accidentalOffset + (octave * 12);
    return 60 /* C4 */ + (semisFromC0 - (0 + 4 * 12));
}

function degreeAccToPitchString(degree: number, acc: Accidental): string {
    const { step, octave } = degreeToStepOctave(degree);
    const accidentalStr = acc === "sharp" ? "#" : acc === "flat" ? "b" : "";
    return `${step}${accidentalStr}${octave}`;
}

function midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// === Component ===

const StaffNoteEditor: React.FC<StaffNoteEditorProps> = ({
    width = 900,
    height = 800,
    beatWidth = 40,
    nRows = 4,
    onChange,
}) => {
    // Layout constants
    const marginLeft = 48; // space for accidentals and left padding
    const marginRight = 24;
    const marginTop = 24;
    const marginBottom = 32;

    const rowMargin = 60


    const staffTop = marginTop + 10;
    const lineGap = 14; // distance between staff lines
    const staffHeight = lineGap * 4 * nRows + rowMargin * (nRows - 1); // distance between top and bottom staff line
    const staffBottom = staffTop + staffHeight;
    const staffLeft = marginLeft;
    const staffRight = width - marginRight;
    const staffMid = (staffTop + staffBottom) / 2;
    const positionStep = lineGap / 2; // each staff degree (line/space)

    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [toolDuration, setToolDuration] = useState<Duration>("quarter");
    const [toolAcc, setToolAcc] = useState<Accidental>(null);
    const [isEraser, setIsEraser] = useState<boolean>(false);
    const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origDegree: number; shift: boolean } | null>(null);

    // Export callback
    useEffect(() => {
        if (!onChange) return;
        const exported: ExportedNote[] = notes.map((n) => {
            const { step, octave } = degreeToStepOctave(n.degree);
            const midi = stepOctaveToMidi(step, octave, n.accidental);
            return {
                id: n.id,
                pitch: degreeAccToPitchString(n.degree, n.accidental),
                midi,
                duration: n.duration,
                x: n.x,
            };
        });
        onChange(exported);
    }, [notes, onChange]);

    // Map Y => staff degree (nearest line/space)
    const yToDegree = (y: number) => {
        // degree 0 is E4 @ bottom line => y = staffBottom
        const degreesFromBottom = Math.round((staffBottom - y) / positionStep);
        return degreesFromBottom; // positive up, negative down
    };

    // Map degree => Y
    const degreeToY = (degree: number) => staffBottom - degree * positionStep;

    // Snap X to grid within staff bounds
    const snapX = (x: number) => {
        const clamped = Math.max(staffLeft + 8, Math.min(staffRight - 8, x));
        const base = staffLeft;
        const step = beatWidth / 2; // finer grid: eighth-note steps horizontally
        const snapped = Math.round((clamped - base) / step) * step + base;
        return snapped;
    };

    // Ledger lines needed for a degree (beyond the 5-line staff)
    const ledgerLineYs = (degree: number) => {
        // Top line degree = 8 (E5), bottom line degree = 0 (E4)
        const lines: number[] = [];
        if (degree > 8) {
            for (let d = 10; d <= degree; d += 2) lines.push(degreeToY(d));
        } else if (degree < 0) {
            for (let d = -2; d >= degree; d -= 2) lines.push(degreeToY(d));
        }
        return lines;
    };

    // Determine stem direction (simple rule)
    const stemUp = (degree: number) => degree < 6; // below/at B4 => stems up

    // Add a note at click location
    const handleAddAt = (evt: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
        const svg = evt.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const ctm = (evt.target as SVGGraphicsElement).getScreenCTM();
        if (!ctm) return;
        const p = pt.matrixTransform(ctm.inverse());

        // Only add within staff vertical band (with some tolerance)
        if (p.y < staffTop - 40 || p.y > staffBottom + 40) return;

        const degree = yToDegree(p.y);
        const x = snapX(p.x);

        if (isEraser) {
            // remove nearest note if within hit radius
            const idx = findNoteAt(x, degree);
            if (idx >= 0) removeAt(idx);
            return;
        }

        const id = cryptoRandomId();
        const note: Note = { id, x, degree, duration: toolDuration, accidental: toolAcc };
        setNotes((prev) => insertNote(prev, note));
        setSelectedId(id);
    };

    // Insert keeping ascending x order (stable)
    function insertNote(arr: Note[], n: Note) {
        const copy = [...arr];
        let i = 0;
        while (i < copy.length && copy[i].x <= n.x) i++;
        copy.splice(i, 0, n);
        return copy;
    }

    const findNoteAt = (x: number, degree: number) => {
        // hit test by XY proximity
        const hitDX = 14;
        const hitDeg = 1; // within one degree
        const idx = notes.findIndex((n) => Math.abs(n.x - x) <= hitDX && Math.abs(n.degree - degree) <= hitDeg);
        return idx;
    };

    const removeAt = (idx: number) => setNotes((prev) => prev.filter((_, i) => i !== idx));

    const handleSelectNote = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

    // Keyboard: delete/escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedId(null);
            if (e.key === "Delete" || e.key === "Backspace") {
                if (!selectedId) return;
                setNotes((prev) => prev.filter((n) => n.id !== selectedId));
                setSelectedId(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedId]);

    // Drag notes: mouse handlers on SVG
    const onMouseDownNote = (id: string) => (e: React.MouseEvent) => {

      

        if (isEraser) {
            // remove nearest note if within hit radius
            const idx = notes.findIndex((n) => n.id === id)
            if (idx >= 0) removeAt(idx);
            return;
        }
        e.stopPropagation();
        setSelectedId(id);
        dragState.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            origX: notes.find((n) => n.id === id)!.x,
            origDegree: notes.find((n) => n.id === id)!.degree,
            shift: e.shiftKey,
        };
    };

    const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!dragState.current) return;
        const ds = dragState.current;
        setNotes((prev) =>
            prev.map((n) => {
                if (n.id !== ds.id) return n;
                let x = ds.origX + (e.clientX - ds.startX);
                x = snapX(x);
                let degree = n.degree;
                if (ds.shift) {
                    // pitch change only when Shift held
                    const deltaY = e.clientY - ds.startY;
                    const steps = Math.round(-deltaY / (positionStep));
                    degree = ds.origDegree + steps;
                }
                return { ...n, x, degree };
            })
        );
    };

    const onMouseUp = () => {
        dragState.current = null;
    };

    // Simple playback
    const play = async () => {
        if (notes.length === 0) return;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const bpm = 96;
        const secPerBeat = 60 / bpm;
        const now = ctx.currentTime;

        let t = now + 0.05;
        for (const n of [...notes].sort((a, b) => a.x - b.x)) {
            const { step, octave } = degreeToStepOctave(n.degree);
            const midi = stepOctaveToMidi(step, octave, n.accidental);
            const freq = midiToFreq(midi);
            const beats = n.duration === "whole" ? 4 : n.duration === "half" ? 2 : n.duration === "quarter" ? 1 : 0.5;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.value = 0.0001;
            osc.connect(gain);
            gain.connect(ctx.destination);

            const dur = beats * secPerBeat;
            // quick attack/decay envelope
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

            osc.start(t);
            osc.stop(t + dur + 0.02);

            t += dur + 0.05; // small gap
        }
    };

    // Render helpers
    const durationToNotehead = (d: Duration) => ({
        filled: d === "quarter" || d === "eighth",
        showStem: d !== "whole",
        flag: d === "eighth",
    });

    const accidentalGlyph = (a: Accidental) => (a === "sharp" ? "♯" : a === "flat" ? "♭" : a === "natural" ? "♮" : "");

    const toolbarButton = (label: React.ReactNode, active: boolean, onClick: () => void, title?: string) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`px-3 py-1 rounded-2xl text-sm border shadow-sm mx-1 ${active ? "bg-black text-white" : "bg-white hover:bg-gray-50"
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="w-full max-w-full select-none">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-2 px-2">
                <span className="text-xs uppercase tracking-wide text-gray-500">Duration</span>
                {toolbarButton("𝅝", toolDuration === "whole", () => setToolDuration("whole"), "Whole note")}
                {toolbarButton("𝅗𝅥", toolDuration === "half", () => setToolDuration("half"), "Half note")}
                {toolbarButton("𝅘𝅥", toolDuration === "quarter", () => setToolDuration("quarter"), "Quarter note")}
                {toolbarButton("𝅘𝅥𝅮", toolDuration === "eighth", () => setToolDuration("eighth"), "Eighth note")}

                <div className="w-px h-6 bg-gray-200 mx-2" />

                <span className="text-xs uppercase tracking-wide text-gray-500">Accidental</span>
                {toolbarButton("♮", toolAcc === "natural", () => setToolAcc("natural"), "Natural")}
                {toolbarButton("♯", toolAcc === "sharp", () => setToolAcc("sharp"), "Sharp")}
                {toolbarButton("♭", toolAcc === "flat", () => setToolAcc("flat"), "Flat")}
                {toolbarButton("—", toolAcc === null, () => setToolAcc(null), "None")}

                <div className="w-px h-6 bg-gray-200 mx-2" />

                {toolbarButton(isEraser ? "Eraser On" : "Eraser", isEraser, () => setIsEraser((s) => !s), "Click to delete notes")}

                <div className="ml-auto" />
                {toolbarButton("Play", false, play, "Play notes left to right")}
                {toolbarButton("Clear", false, () => setNotes([]), "Remove all notes")}
            </div>

            {/* Staff + Notes */}
            <svg
                width={width}
                height={height}
                className="bg-white rounded-2xl shadow border"
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onClick={handleAddAt}
            >
                {/* Staff background */}
                <rect x={0} y={0} width={width} height={height} fill="white" rx={16} />

                {/* Staff lines */}

                {[0, 1, 2, 3, 4].map((i) => (
                    <line
                        key={i}
                        x1={staffLeft}
                        x2={staffRight}
                        y1={staffTop + i * lineGap}
                        y2={staffTop + i * lineGap}
                        stroke="#222"
                        strokeWidth={1.2}
                    />
                ))}

                {[
                    ...Array(nRows),
                ].map((value: undefined, rowi: number) => (
                    [0, 1, 2, 3, 4].map((i) => (
                        <line
                            key={i}
                            x1={staffLeft}
                            x2={staffRight}
                            y1={staffTop + i * lineGap + rowi * (lineGap * 4 + rowMargin)}
                            y2={staffTop + i * lineGap + rowi * (lineGap * 4 + rowMargin) }
                            stroke="#222"
                            strokeWidth={1.2}
                        />
                  ))
                ))}
              
                {/* Left label (simple treble indicator) */}
                <text x={12} y={staffMid + 6} fontSize={20} fill="#444" style={{ fontFamily: "serif" }}>
                    𝄞
                </text>

                {/* Vertical grid guidelines (subtle) */}
                {Array.from({ length: Math.floor((staffRight - staffLeft) / (beatWidth / 2)) + 1 }).map((_, i) => (
                    <line
                        key={`g${i}`}
                        x1={staffLeft + i * (beatWidth / 2)}
                        x2={staffLeft + i * (beatWidth / 2)}
                        y1={staffTop - 18}
                        y2={staffBottom + 18}
                        stroke="#ddd"
                        strokeDasharray="4 4"
                        strokeWidth={0.6}
                    />
                ))}

                {/* Notes */}
                {notes.map((n) => {
                    const y = degreeToY(n.degree);
                    const { filled, showStem, flag } = durationToNotehead(n.duration);
                    const stemIsUp = stemUp(n.degree);
                    const stemX = stemIsUp ? n.x + 8 : n.x - 8;
                    const stemY1 = y + (filled ? 0 : 0); // top of notehead
                    const stemY2 = stemIsUp ? y - 35 : y + 35;
                    const isSelected = n.id === selectedId;

                    return (
                        <g key={n.id} onMouseDown={onMouseDownNote(n.id)} onClick={(e) => { e.stopPropagation(); handleSelectNote(n.id); }}>
                            {/* ledger lines */}
                            {ledgerLineYs(n.degree).map((ly, idx) => (
                                <line key={`ll${idx}`} x1={n.x - 14} x2={n.x + 14} y1={ly} y2={ly} stroke="#222" strokeWidth={1} />
                            ))}

                            {/* accidental */}
                            {n.accidental && (
                                <text x={n.x - 20} y={y + 5} fontSize={16} fill="#111" style={{ fontFamily: "serif" }}>
                                    {accidentalGlyph(n.accidental)}
                                </text>
                            )}

                            {/* notehead */}
                            <ellipse
                                cx={n.x}
                                cy={y}
                                rx={9}
                                ry={7}
                                transform={`rotate(-20 ${n.x} ${y})`}
                                fill={filled ? (isSelected ? "#2563eb" : "#111") : "white"}
                                stroke={isSelected ? "#2563eb" : "#111"}
                                strokeWidth={1.4}
                            />

                            {/* stem */}
                            {showStem && (
                                <line x1={stemX} x2={stemX} y1={stemIsUp ? y - 1 : y + 1} y2={stemY2} stroke={isSelected ? "#2563eb" : "#111"} strokeWidth={1.4} />
                            )}

                            {/* simple flag for eighth notes */}
                            {flag && (
                                <path
                                    d={stemIsUp ? `M ${stemX} ${stemY2} c 8 4, 16 8, 16 18 c -7 -5, -14 -7, -16 -8 z` : `M ${stemX} ${stemY2} c -8 -4, -16 -8, -16 -18 c 7 5, 14 7, 16 8 z`}
                                    fill={isSelected ? "#2563eb" : "#111"}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Legend & tips */}
            <div className="text-xs text-gray-500 mt-2 px-1">
                Click to add notes. Use the toolbar to set duration & accidental. Click a note to select, then press Delete/Backspace to remove. Hold <kbd>Shift</kbd> while dragging to change pitch; drag without Shift to move in time.
            </div>
        </div>
    );
};

export default StaffNoteEditor;

// === Utilities ===
function cryptoRandomId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
    return Math.random().toString(36).slice(2);
}
