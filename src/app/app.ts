import { Component, HostListener } from '@angular/core';
import { CircleComponent } from './circle/circle.component';
import { TextComponent } from './text/text.component';

declare const fabric: any;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CircleComponent, TextComponent],
  template: `
    <div class="flex h-screen w-screen bg-gray-100">
      <!-- Sidebar -->
      <div class="w-48 bg-white shadow-lg flex flex-col items-stretch py-6 gap-3">
        <div class="px-3">
          <button class="w-full border rounded px-3 py-2" (click)="undo()" [disabled]="!canUndo()">Undo (Ctrl+Z)</button>
        </div>
        <div class="px-3">
          <button class="w-full border rounded px-3 py-2" (click)="redo()" [disabled]="!canRedo()">Redo (Ctrl+Y)</button>
        </div>
        <div class="h-px bg-gray-200 my-2"></div>
        <div class="flex flex-col items-center gap-6">
          <app-circle (circleAdded)="handleCircle($event)"></app-circle>
          <app-text (textAdded)="handleText($event)"></app-text>
        </div>
      </div>

      <!-- Main Canvas Area -->
      <div class="flex-1 flex justify-center items-center">
        <div class="bg-white shadow-xl p-4 rounded-xl">
          <canvas id="myCanvas" width="800" height="600" class="border border-gray-300"></canvas>
        </div>
      </div>
    </div>
  `
})
export class App {
  canvas: any;

  // ---- History state ----
  private history: string[] = [];
  private historyIndex = -1;
  private isRestoring = false;
  private readonly HISTORY_LIMIT = 100;

  ngOnInit() {
    this.canvas = new fabric.Canvas('myCanvas', {
      backgroundColor: '#fff',
      selection: true
    });

    // Hook text edit sessions to make one snapshot when user finishes typing
    const hookTextCommit = (o: any) => {
      if (o && (o.type === 'i-text' || o.type === 'textbox') && !(o as any).__historyHooked) {
        (o as any).__historyHooked = true;
        o.on('editing:exited', () => this.pushHistory());
      }
    };
    this.canvas.getObjects().forEach(hookTextCommit);
    this.canvas.on('object:added', (e: any) => hookTextCommit(e?.target));

    // Initialize history tracking
    this.initHistory();
  }

  // ------- Add shapes/text -------
  handleCircle(circleData: any) {
    const circle = new fabric.Circle({ ...circleData });
    (circle as any).id = circleData.id;
    this.canvas.add(circle).setActiveObject(circle);
    this.canvas.requestRenderAll();
    // object:added will snapshot for us
  }

  handleText(textData: any) {
    const text = new fabric.IText(textData.text, { ...textData });
    (text as any).id = textData.id;
    this.canvas.add(text).setActiveObject(text);
    this.canvas.requestRenderAll();
    // object:added will snapshot; editing:exited will snapshot after edits
  }

  // ------- Keyboard shortcuts (Undo/Redo + Delete/Escape + Backspace-empty you already had) -------
  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (!this.canvas) return;

    // --- Undo / Redo ---
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (ctrlOrMeta && key === 'z') {
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      e.preventDefault();
      return;
    }
    if (ctrlOrMeta && key === 'y') {
      this.redo();
      e.preventDefault();
      return;
    }

    // Keep your existing Backspace-empty and Delete/Escape logic
    const activeObjects = this.canvas.getActiveObjects?.() ?? [];
    const hasSelection = activeObjects.length > 0;

    // Backspace: delete ONLY an empty active IText (whitespace = empty)
    if (e.key === 'Backspace') {
      if (activeObjects.length === 1) {
        const obj: any = activeObjects[0];
        if (obj?.type === 'i-text') {
          const activeEl = document.activeElement as HTMLElement | null;
          const hidden = (obj as any).hiddenTextarea as HTMLTextAreaElement | undefined;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            if (!hidden || activeEl !== hidden) return;
          }
          const content = (obj.text ?? '').replace(/\s/g, '');
          if (content.length === 0) {
            if (obj.isEditing) obj.exitEditing();
            this.canvas.remove(obj);
            this.canvas.discardActiveObject();
            this.canvas.requestRenderAll();
            this.pushHistory(); // record the deletion
            e.preventDefault();
            return;
          }
        }
      }
      return;
    }

    // Delete / Escape: remove selected object(s)
    if (e.key === 'Delete' || e.key === 'Escape') {
      if (!hasSelection) return;
      activeObjects.forEach((obj: any) => {
        if (obj.type === 'i-text' && obj.isEditing) obj.exitEditing();
        this.canvas.remove(obj);
      });
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.pushHistory(); // record the deletion
      e.preventDefault();
      return;
    }
  }

  // ------- Undo/Redo public actions (buttons call these) -------
  canUndo(): boolean {
    return this.historyIndex > 0;
  }
  canRedo(): boolean {
    return this.historyIndex >= 0 && this.historyIndex < this.history.length - 1;
  }

  undo(): void {
    if (!this.canUndo()) return;
    this.historyIndex--;
    this.restore(this.history[this.historyIndex]);
  }

  redo(): void {
    if (!this.canRedo()) return;
    this.historyIndex++;
    this.restore(this.history[this.historyIndex]);
  }

  // ------- History internals -------
  private serialize(): string {
    // Add any custom props you want to preserve (e.g., 'id')
    return JSON.stringify(this.canvas.toJSON(['id']));
  }

  private restore(json: string): void {
    this.isRestoring = true;
    this.canvas.loadFromJSON(json, () => {
      // Re-add the text edit exit hook after restore
      this.canvas.getObjects().forEach((o: any) => {
        if (o.type === 'i-text' || o.type === 'textbox') {
          if (!(o as any).__historyHooked) {
            (o as any).__historyHooked = true;
            o.on('editing:exited', () => this.pushHistory());
          }
        }
      });
      this.canvas.renderAll();
      this.isRestoring = false;
    });
  }

  private pushHistory(): void {
    if (this.isRestoring) return;
    const snapshot = this.serialize();

    // Avoid duplicate consecutive snapshots
    if (this.historyIndex >= 0 && this.history[this.historyIndex] === snapshot) return;

    // Drop any redo branch
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(snapshot);

    if (this.history.length > this.HISTORY_LIMIT) {
      // Trim the oldest and keep index at end
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  private initHistory(): void {
    // Baseline empty snapshot
    this.pushHistory();

    const commit = () => this.pushHistory();
    // Snapshot on structure-changing events
    this.canvas.on('object:added', () => { if (!this.isRestoring) commit(); });
    this.canvas.on('object:modified', commit);
    this.canvas.on('object:removed', commit);
    this.canvas.on('path:created', commit);
  }
}
