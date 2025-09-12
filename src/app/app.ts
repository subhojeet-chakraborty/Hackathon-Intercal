import { Component , HostListener} from '@angular/core';
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
      <div class="w-40 bg-white shadow-lg flex flex-col items-center py-6 gap-6">
        <app-circle (circleAdded)="handleCircle($event)"></app-circle>
        <app-text (textAdded)="handleText($event)"></app-text>
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

  ngOnInit() {
    this.canvas = new fabric.Canvas('myCanvas', {
      backgroundColor: '#fff',
      selection: true
    });
  }

  handleCircle(circleData: any) {
    const circle = new fabric.Circle({ ...circleData });
    (circle as any).id = circleData.id;
    this.canvas.add(circle).setActiveObject(circle);
  }

  handleText(textData: any) {
    const text = new fabric.IText(textData.text, { ...textData });
    (text as any).id = textData.id;
    this.canvas.add(text).setActiveObject(text);
  }

  @HostListener('window:keydown', ['$event'])
onKeyDown(e: KeyboardEvent) {
  if (!this.canvas) return;

  const activeObjects = this.canvas.getActiveObjects?.() ?? [];
  const hasSelection = activeObjects.length > 0;

  // 1) Backspace: delete ONLY an empty active IText (whitespace = empty)
  if (e.key === 'Backspace') {
    if (activeObjects.length === 1) {
      const obj: any = activeObjects[0];
      if (obj?.type === 'i-text') {
        // If a real input is focused (not Fabric's hidden textarea), ignore
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
          e.preventDefault(); // block browser default
          return;
        }
      }
    }
    // If not handled above (e.g., text has content), let Fabric/browser handle Backspace
    return;
  }

  // 2) Delete / Escape: remove any selected object(s)
  if (e.key === 'Delete' || e.key === 'Escape') {
    if (!hasSelection) return;

    activeObjects.forEach((obj: any) => {
      if (obj.type === 'i-text' && obj.isEditing) obj.exitEditing();
      this.canvas.remove(obj);
    });
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    e.preventDefault();
    return;
  }
}

}
