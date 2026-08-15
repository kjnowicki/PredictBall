import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { PredictionTileComponent } from './prediction.tile.component';

describe('PredictionTileComponent', () => {
  let component: PredictionTileComponent;
  let fixture: ComponentFixture<PredictionTileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PredictionTileComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PredictionTileComponent);
    component = fixture.componentInstance;
    component.match = {
      id: 1,
      homeTeamId: 10,
      awayTeamId: 20,
      startTime: new Date().toISOString(),
      status: 'SCHEDULED',
      matchday: 1,
      stage: 'REGULAR_SEASON'
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

