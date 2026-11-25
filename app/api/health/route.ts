import mongoose from "mongoose";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";

/** Para monitores de disponibilidade (UptimeRobot, Better Stack): 200 se o app e o banco respondem. */
export async function GET() {
  const started = Date.now();
  try {
    await dbConnect();
    await mongoose.connection.db!.admin().ping();
    return NextResponse.json(
      { status: "ok", database: "ok", latencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[health]", error);
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
