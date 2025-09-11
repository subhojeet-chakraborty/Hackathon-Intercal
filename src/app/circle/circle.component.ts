import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-circle',
  standalone: true,
  templateUrl: './circle.component.html',
  styleUrls: ['./circle.component.css']
})
export class CircleComponent {
  private circleCounter = 0;

  @Output() circleAdded = new EventEmitter<any>();

  addCircle() {
    this.circleCounter++;
    const circleId = `circle-${this.circleCounter}`;

    this.circleAdded.emit({
      id: circleId,
      type: 'circle',
      left: 200,
      top: 200,
      radius: 40,
      fill: 'lightpink',
      stroke: 'red',
      strokeWidth: 2
    });
  }
}
