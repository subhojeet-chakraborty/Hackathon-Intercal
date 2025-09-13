import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type BarcodeType = 'CODE128' | 'CODE39' | 'EAN13' | 'UPC' | 'ITF';

export interface BarcodeOptions {
  barWidth: number;      // stroke thickness
  barHeight: number;     // bar height
  displayValue: boolean; // show human-readable text
  fontSize: number;      // text font size
}

export interface BarcodeState {
  id?: string;
  type: BarcodeType;
  value: string;
  options: BarcodeOptions;
}

export interface BarcodeCreateOrReplace extends BarcodeState {
  mode: 'insert' | 'replace';
}

@Component({
  selector: 'app-barcode',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './barcode.html',
  styleUrls: ['./barcode.css']
})
export class BarcodeComponent {
  @Output() barcodeAdded = new EventEmitter<BarcodeCreateOrReplace>();
  @Output() barcodeUpdated = new EventEmitter<BarcodeState>();

  private _selected: BarcodeState | null = null;
  @Input() set selected(state: BarcodeState | null) {
    this._selected = state;
    if (state) {
      // Deep copy to avoid mutating parent state while editing
      this.edit = JSON.parse(JSON.stringify(state));
      this.validateEdit();
    } else {
      this.edit = null as any;
      this.editError = '';
    }
  }
  get selected(): BarcodeState | null { return this._selected; }

  // Create panel model
  create: BarcodeState = {
    type: 'CODE128',
    value: 'HELLO-12345',
    options: { barWidth: 2, barHeight: 80, displayValue: true, fontSize: 14 }
  };
  createMode: 'insert' | 'replace' = 'insert';
  createError = '';

  // Edit panel model
  edit: BarcodeState | null = null;
  editError = '';

  private newId(): string {
    return (crypto as any)?.randomUUID?.() ?? String(Date.now());
  }

  addBarcode() {
  this.validateCreate();
  if (this.createError) return;

  this.barcodeAdded.emit({
    id: this.newId(),
    type: this.create.type,
    value: this.create.value,
    options: { ...this.create.options },
    mode: this.createMode
  });

  // Reset the create box so the SAME textbox is ready for the next entry
  this.create.value = '';
  // Optional: keep focus in the same field (requires a template ref; ask if you want it)
  // setTimeout(() => this.createValueInput?.nativeElement.focus(), 0);
}


  emitUpdate() {
    if (!this.edit) return;
    this.validateEdit();
    if (this.editError) return;
    this.barcodeUpdated.emit({
      id: this.edit.id,
      type: this.edit.type,
      value: this.edit.value,
      options: { ...this.edit.options }
    });
  }

  // --------- Validation per type ----------
  validateCreate() {
    this.createError = this.validate(this.create.type, this.create.value);
  }

  validateEdit() {
    if (!this.edit) return;
    this.editError = this.validate(this.edit.type, this.edit.value);
  }

  private validate(type: BarcodeType, value: string): string {
    const digits = /^[0-9]+$/;
    const code39 = /^[0-9A-Z \-.\$/%+]+$/; // uppercase + allowed symbols

    switch (type) {
      case 'CODE128':
        return value?.length ? '' : 'Value required for CODE128';

      case 'CODE39':
        if (!value?.length) return 'Value required for CODE39';
        if (!code39.test(value)) return 'CODE39 allows A–Z, 0–9, space, - . $ / % +';
        return '';

      case 'EAN13':
        if (!digits.test(value)) return 'EAN-13 must be digits only';
        if (value.length === 12) return ''; // JsBarcode computes check digit
        if (value.length === 13) {
          return (this.ean13Check(value.slice(0, 12)) === Number(value[12]))
            ? '' : 'Invalid EAN-13 check digit';
        }
        return 'EAN-13 must be 12 or 13 digits';

      case 'UPC':
        if (!digits.test(value)) return 'UPC-A must be digits only';
        if (value.length === 11) return ''; // JsBarcode computes check digit
        if (value.length === 12) {
          return (this.upcCheck(value.slice(0, 11)) === Number(value[11]))
            ? '' : 'Invalid UPC-A check digit';
        }
        return 'UPC-A must be 11 or 12 digits';

      case 'ITF':
        if (!digits.test(value)) return 'ITF must be digits only';
        if (value.length < 2 || value.length % 2 !== 0) return 'ITF requires an even number of digits';
        return '';

      default:
        return '';
    }
  }

  private ean13Check(code12: string): number {
    const d = code12.split('').map(n => +n);
    const sumOdd = d[0] + d[2] + d[4] + d[6] + d[8] + d[10];
    const sumEven = d[1] + d[3] + d[5] + d[7] + d[9] + d[11];
    const total = sumOdd + sumEven * 3;
    return (10 - (total % 10)) % 10;
  }

  private upcCheck(code11: string): number {
    const d = code11.split('').map(n => +n);
    // odd positions (1st,3rd,...) * 3 + even positions
    const sumOdd = d.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
    const sumEven = d.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
    const total = sumOdd * 3 + sumEven;
    return (10 - (total % 10)) % 10;
  }
}
