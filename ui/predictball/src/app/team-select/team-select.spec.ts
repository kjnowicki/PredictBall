import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TeamSelect } from './team-select';

describe('TeamSelect', () => {
  let component: TeamSelect;
  let fixture: ComponentFixture<TeamSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamSelect],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: { match: { id: 1, homeTeamId: 1, awayTeamId: 2 } } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeamSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

