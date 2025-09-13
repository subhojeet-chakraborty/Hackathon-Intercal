import { Component, HostListener, AfterViewInit } from '@angular/core';
import { CircleComponent } from './circle/circle.component';
import { TextComponent } from './text/text.component';
import {
  BarcodeComponent,
  BarcodeState,
  BarcodeOptions,
  BarcodeType
} from './barcode/barcode'; // keep this path if that's your file


declare const fabric: any;
// If you used the CDN script in index.html, keep this:
declare const JsBarcode: any;
// If you installed via npm instead, remove the line above and uncomment this:
// // @ts-ignore
// import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CircleComponent, TextComponent, BarcodeComponent],
  template: `
    <div class="flex h-screen w-screen bg-gray-100">
      <!-- Sidebar -->
      <div class="w-48 bg-white shadow-lg flex flex-col items-stretch py-6 gap-4">
        <div class="flex flex-col items-center gap-6">
          <app-circle (circleAdded)="handleCircle($event)"></app-circle>
          <app-text (textAdded)="handleText($event)"></app-text>

          <!-- Barcode create + properties panel -->
          <app-barcode
            (barcodeAdded)="handleBarcodeAdd($event)"
            [selected]="selectedBarcode"
            (barcodeUpdated)="handleBarcodeUpdate($event)">
          </app-barcode>
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
export class App implements AfterViewInit {
  canvas: any;

  // Keeps the barcode properties panel in sync with the current selection
  selectedBarcode: BarcodeState | null = null;

  // -------------------------------- Lifecycle --------------------------------
  ngAfterViewInit() {
    this.canvas = new fabric.Canvas('myCanvas', {
      backgroundColor: '#fff',
      selection: true
    });

    // Keep side-panel synced to selection
    this.canvas.on('selection:created', (e: any) => this.syncSelected(e));
    this.canvas.on('selection:updated', (e: any) => this.syncSelected(e));
    this.canvas.on('selection:cleared', () => (this.selectedBarcode = null));
  }

  private syncSelected(e: any) {
    const obj: any = (e?.selected && e.selected[0]) || e?.target;
    if (obj && obj.isBarcode) {
      this.selectedBarcode = {
        id: obj.id,
        type: obj.barcodeType,
        value: obj.barcodeValue,
        options: { ...obj.barcodeOpts }
      };
    } else {
      this.selectedBarcode = null;
    }
  }

  // ------------------------------- Add Shapes --------------------------------
  handleCircle(circleData: any) {
    const circle = new fabric.Circle({ ...circleData });
    (circle as any).id = circleData.id;
    this.canvas.add(circle).setActiveObject(circle);
    this.canvas.requestRenderAll();
  }

  handleText(textData: any) {
    const text = new fabric.IText(textData.text, { ...textData });
    (text as any).id = textData.id;
    this.canvas.add(text).setActiveObject(text);
    this.canvas.requestRenderAll();
  }
handleBarcodeAdd(state: BarcodeState & { mode: 'insert' | 'replace' }) {
  // If user chose "replace" and a barcode is selected, update it in place
  if (state.mode === 'replace') {
    const obj: any = this.canvas.getActiveObject?.();
    if (obj && obj.isBarcode) {
      obj.barcodeType = state.type;
      obj.barcodeValue = state.value;
      obj.barcodeOpts = { ...state.options };

      const { left, top, scaleX, scaleY, angle } = obj;
      const dataUrl = this.generateBarcodePng(state.value, state.type, state.options);

      obj.setSrc(
        dataUrl,
        () => {
          obj.set({ left, top, scaleX, scaleY, angle });
          this.canvas.requestRenderAll();
        },
        { crossOrigin: 'anonymous' }
      );
      return;
    }
    // If nothing selected (or not a barcode), fall through to insert.
  }

  // Insert a new barcode image
  const dataUrl = this.generateBarcodePng(state.value, state.type, state.options);

  fabric.Image.fromURL(
    dataUrl,
    (img: any) => {
      if (!img) return;

      // Tag with metadata so we can edit later
      img.isBarcode = true;
      img.id = state.id;
      img.barcodeType = state.type;
      img.barcodeValue = state.value;
      img.barcodeOpts = { ...state.options };

      img.set({
        left: 150,
        top: 120,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        lockScalingFlip: true,
        objectCaching: false
      });

      // Nice initial visual size
      const targetWidth = 320;
      const scale = targetWidth / (img.width || 1);
      img.scale(scale);

      // Note: DO NOT setActiveObject here — prevents the Selected panel from appearing
      this.canvas.add(img);
      this.canvas.requestRenderAll();
    },
    { crossOrigin: 'anonymous' }
  );
}


  // Live-update currently selected barcode from the properties panel
  handleBarcodeUpdate(state: BarcodeState) {
    const obj: any = this.canvas.getActiveObject?.();
    if (!obj || !obj.isBarcode) return;

    obj.barcodeType = state.type;
    obj.barcodeValue = state.value;
    obj.barcodeOpts = { ...state.options };

    const { left, top, scaleX, scaleY, angle } = obj;
    const dataUrl = this.generateBarcodePng(state.value, state.type, state.options);

    obj.setSrc(
      dataUrl,
      () => {
        obj.set({ left, top, scaleX, scaleY, angle });
        this.canvas.requestRenderAll();
      },
      { crossOrigin: 'anonymous' }
    );
  }

  // -------------------------- Barcode PNG Generator ---------------------------
  private generateBarcodePng(value: string, type: BarcodeType, opts: BarcodeOptions): string {
    const JB = typeof JsBarcode !== 'undefined' ? JsBarcode : (window as any).JsBarcode;
    if (typeof JB !== 'function') {
      throw new Error('JsBarcode is not loaded. Add the CDN script in index.html or install via npm.');
    }

    const c = document.createElement('canvas');
    JB(c, value, {
      format: type,
      width: Math.max(1, Math.min(4, opts.barWidth)),
      height: Math.max(10, Math.min(500, opts.barHeight)),
      displayValue: !!opts.displayValue,
      font: 'monospace',
      fontSize: opts.fontSize ?? 14,
      margin: 10
    });
    return c.toDataURL('image/png');
  }

  // ------------------------------ Key Handling -------------------------------
  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (!this.canvas) return;

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
            e.preventDefault();
            return;
          }
        }
      }
      return;
    }

    // Delete / Escape: remove any selected object(s)
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
