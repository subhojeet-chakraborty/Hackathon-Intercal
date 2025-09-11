import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-text',
  standalone: true,
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.css']
})
export class TextComponent {
  private textCounter = 0;

  @Output() textAdded = new EventEmitter<any>();

  addText() {
    this.textCounter++;
    const textId = `text-${this.textCounter}`;

    this.textAdded.emit({
      id: textId,
      type: 'text',
      text: 'Edit me',
      left: 100,
      top: 100,
      fontSize: 20,
      fill: 'blue'
    });
  }
}
