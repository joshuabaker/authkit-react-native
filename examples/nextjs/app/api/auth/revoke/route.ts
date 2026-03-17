import { NextResponse } from "next/server";
import { revokeSchema, revokeSession } from "../lib";

export async function POST(request: Request) {
  const body = await request.formData();
  const params = revokeSchema.parse(Object.fromEntries(body));

  try {
    const result = await revokeSession(params);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
