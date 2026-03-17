import { NextResponse } from "next/server";
import { exchangeToken, tokenSchema } from "../lib";

export async function POST(request: Request) {
  const body = await request.formData();
  const params = tokenSchema.parse(Object.fromEntries(body));

  try {
    const response = await exchangeToken({
      ...params,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
