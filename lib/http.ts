import { NextResponse } from 'next/server';
import { AuthError } from './auth';

export function ok(data: any, init?: number) {
  return NextResponse.json({ success: true, data }, { status: init || 200 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function handleApiError(err: any) {
  if (err instanceof AuthError) {
    return fail(err.message, err.status);
  }
  console.error(err);
  return fail(err?.message || 'Something went wrong', 500);
}
