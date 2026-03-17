import { NextResponse } from "next/server";
import { authorizeSchema, getAuthorizationUrl } from "../lib";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = authorizeSchema.parse(Object.fromEntries(url.searchParams));
  const authorizationUrl = getAuthorizationUrl(params);
  return NextResponse.redirect(authorizationUrl);
}
