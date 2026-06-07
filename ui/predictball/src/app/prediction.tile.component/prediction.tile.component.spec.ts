import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PredictionTileComponent } from './prediction.tile.component';

describe('PredictionTileComponent', () => {
  let component: PredictionTileComponent;
  let fixture: ComponentFixture<PredictionTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionTileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PredictionTileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
