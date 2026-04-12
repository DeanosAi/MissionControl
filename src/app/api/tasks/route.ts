import { NextResponse } from 'next/server';
import { organizeTasks, hasTaskChanges, type Task } from '@/lib/tasks';
import { resolveDataPath } from '@/lib/runtime';
import { readJsonFile, writeJsonFile } from '@/lib/storage';

function readTasks() {
  return readJsonFile(resolveDataPath('tasks.json'), [] as Task[]);
}

function writeTasks(tasks: Task[]) {
  writeJsonFile(resolveDataPath('tasks.json'), tasks);
}

export async function GET() {
  try {
    const stored = readTasks();
    const organized = organizeTasks(stored);

    if (hasTaskChanges(stored, organized)) {
      writeTasks(organized);
    }

    return NextResponse.json(organized);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(request: Request) {
  try {
    const data = (await request.json()) as Task[];
    const organized = organizeTasks(data);
    writeTasks(organized);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
