"use client";
import { AppShell } from "../../web/components/app-shell";
import { browserDemo } from "../lib/browser-demo";
export default function Page() { return <AppShell browserDemo={browserDemo} />; }
