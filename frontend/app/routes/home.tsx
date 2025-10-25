import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";
import NoteEditor from "../components/NoteEditor";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "5 Minutes of Harmony" },
    { name: "description", content: "r/place on a musical staff" },
  ];
}

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <NoteEditor width={1600} />
    </div>
  );
}
