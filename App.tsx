import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  closestCenter,
  pointerWithin,
  CollisionDetection,
} from '@dnd-kit/core';
import { GRID_COLS, GRID_ROWS, TOTAL_CELLS, KEYBOARD_LAYOUT } from './constants';
import { GridState, DragData } from './types';
import { DroppableCell } from './components/DroppableCell';
import { DraggableItem } from './components/DraggableItem';
import { Tile } from './components/Tile';
import { playSound, speakText } from './audio';

// Toolbar Button Component
interface ToolbarButtonProps {
  color: 'red' | 'green' | 'blue';
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ color, icon, onClick, label, disabled }) => {
  let colorClasses = "";
  if (color === 'red') colorClasses = "bg-red-600 border-red-800 hover:bg-red-500 active:border-b-0 active:translate-y-[2px]";
  if (color === 'green') colorClasses = "bg-green-600 border-green-800 hover:bg-green-500 active:border-b-0 active:translate-y-[2px]";
  if (color === 'blue') colorClasses = "bg-blue-600 border-blue-800 hover:bg-blue-500 active:border-b-0 active:translate-y-[2px]";
  
  if (disabled) {
    colorClasses = "bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed";
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative h-full w-full flex flex-col sm:flex-row items-center justify-center font-bold text-white rounded shadow-sm select-none border-b-4 transition-all ${colorClasses}`}
    >
      <div className="scale-75 sm:scale-100">{icon}</div>
      {label && <span className="text-[10px] sm:text-sm sm:ml-2 leading-none">{label}</span>}
    </button>
  );
};

interface KeyboardAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function KeyboardArea({ children, className, style }: KeyboardAreaProps) {
  const { setNodeRef } = useDroppable({
    id: 'keyboard-area',
    data: { type: 'keyboard-area' }
  });
  return (
    <div ref={setNodeRef} className={className} style={style}>
      {children}
    </div>
  );
}

// Custom collision detection
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCenter(args);
};

const getConnectedWord = (state: GridState, index: number): string => {
  if (!state[index]) return '';

  const row = Math.floor(index / GRID_COLS);
  let start = index;
  let end = index;

  while (start > 0 && Math.floor((start - 1) / GRID_COLS) === row && state[start - 1]) {
    start--;
  }
  while (end < TOTAL_CELLS - 1 && Math.floor((end + 1) / GRID_COLS) === row && state[end + 1]) {
    end++;
  }

  let word = '';
  for (let i = start; i <= end; i++) {
    word += state[i].char;
  }
  return word;
};

const getAllText = (state: GridState): string => {
  const rows: string[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    let rowText = '';
    for (let c = 0; c < GRID_COLS; c++) {
      const idx = r * GRID_COLS + c;
      const item = state[idx];
      if (item) {
        rowText += item.char;
      } else {
        if (rowText.length > 0 && rowText[rowText.length - 1] !== ' ') {
          rowText += ' ';
        }
      }
    }
    const cleanRow = rowText.trim();
    if (cleanRow.length > 0) {
      rows.push(cleanRow);
    }
  }
  return rows.join('. ');
};

export default function App() {
  const [gridState, setGridState] = useState<GridState>({});
  const [history, setHistory] = useState<GridState[]>([]);
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [dragSize, setDragSize] = useState<{width: number, height: number} | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setGridState(previous);
    playSound('rustle');
  };

  const handleClear = () => {
    if (Object.keys(gridState).length === 0) return;
    setHistory(prev => [...prev, gridState]);
    setGridState({});
    playSound('rustle');
  };

  const handleSpeakAll = () => {
    const text = getAllText(gridState);
    if (text) {
      speakText(text);
    }
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DragData;
    setActiveDragData(data);

    const node = document.getElementById(active.id as string);
    if (node) {
      const rect = node.getBoundingClientRect();
      setDragSize({ width: rect.width, height: rect.height });
    }

    if (data.origin === 'grid') {
      playSound('rustle'); 
    } else {
      playSound('grab');
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const data = active.data.current as DragData;

    setActiveDragData(null);
    setDragSize(null);
    playSound('drop');

    if (!over) return;

    const currentGridState = gridState;

    // Moving back to keyboard area (delete)
    if (data.origin === 'grid' && over.id === 'keyboard-area') {
       setHistory(prev => [...prev, currentGridState]);
       setGridState((prev) => {
         const newState = { ...prev };
         if (data.index !== undefined) delete newState[data.index];
         return newState;
       });
       return;
    }

    if (over.id.toString().startsWith('cell-')) {
      const targetIndex = over.data.current?.index as number;
      if (targetIndex !== undefined) {
        const nextState = { ...gridState };
        const existingItem = nextState[targetIndex];
        let didChange = false;

        if (data.origin === 'grid' && data.index !== undefined) {
          if (data.index !== targetIndex) {
            delete nextState[data.index];
            if (existingItem) {
              nextState[data.index] = existingItem;
            }
            nextState[targetIndex] = {
              char: data.char,
              id: data.id || `item-${Date.now()}`
            };
            didChange = true;
          }
        }
        else if (data.origin === 'keyboard') {
           const newId = `placed-${data.char}-${Date.now()}-${Math.random()}`;
           nextState[targetIndex] = {
             char: data.char,
             id: newId
           };
           didChange = true;
        }

        if (didChange) {
          setHistory(prev => [...prev, currentGridState]);
          setGridState(nextState);

          const word = getConnectedWord(nextState, targetIndex);
          if (word.length >= 2) {
            speakText(word);
          } else {
            speakText(data.char);
          }
        }
      }
    }
  }, [gridState]); 

  const handleGridClick = (index: number, char: string) => {
    const col = index % GRID_COLS;
    const isStartOfWord = col === 0 || !gridState[index - 1];
    if (isStartOfWord) {
      const fullText = getAllText(gridState);
      if (fullText) speakText(fullText);
    } else {
      speakText(char);
    }
  };

  // Calculations for responsive layout
  // We want the whole workspace (Grid + Keyboard) to fit in the screen.
  // Grid: 5 rows. Keyboard: 3 rows. Toolbar: Fixed/Adaptive.
  // Effective content aspect ratio: 11 cols / (5 + 3 + gap) rows.
  // We use a container with aspectRatio to constrain the internal items.
  const GRID_ROWS_COUNT = 5;
  const KEYBOARD_ROWS_COUNT = 3;
  const SPACING_WEIGHT = 0.5; // Gap between grid and keyboard roughly equal to half a row
  const TOTAL_WEIGHT_ROWS = GRID_ROWS_COUNT + KEYBOARD_ROWS_COUNT + SPACING_WEIGHT;
  
  const aspectRatio = `${GRID_COLS} / ${TOTAL_WEIGHT_ROWS}`;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
      autoScroll={false} 
    >
      <div className="h-[100dvh] w-full bg-neutral-800 flex flex-col items-center overflow-hidden touch-none">
        
        <div className="w-full h-full flex flex-col p-2 gap-2 max-w-7xl">
          
          {/* TOOLBAR */}
          <div className="flex w-full gap-2 shrink-0 h-[8vh] min-h-[40px] max-h-[60px]">
            <ToolbarButton 
              color="red" 
              onClick={handleUndo} 
              disabled={history.length === 0}
              label="Назад"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              }
            />
            <ToolbarButton 
              color="green" 
              onClick={handleClear}
              label="Очистить"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
            />
            <ToolbarButton 
              color="blue" 
              onClick={handleSpeakAll}
              label="Произнести"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              }
            />
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            
            {/* Unified container for Grid and Keyboard to maintain aspect ratio */}
            <div 
              className="w-full flex flex-col gap-2 sm:gap-4"
              style={{
                aspectRatio: aspectRatio,
                maxHeight: '100%',
                maxWidth: '100%'
              }}
            >
              
              {/* GRID AREA */}
              <div 
                className="bg-neutral-900 rounded-lg border border-neutral-700 p-1 relative"
                style={{ flex: GRID_ROWS_COUNT }}
              >
                <div 
                  className="grid w-full h-full"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                    gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                    gap: '2px'
                  }}
                >
                  {Array.from({ length: TOTAL_CELLS }).map((_, index) => {
                    const item = gridState[index];
                    return (
                      <DroppableCell key={index} index={index}>
                        {item ? (
                          <DraggableItem
                            id={item.id}
                            char={item.char}
                            origin="grid"
                            index={index}
                            onGridClick={handleGridClick}
                          />
                        ) : null}
                      </DroppableCell>
                    );
                  })}
                </div>
              </div>

              {/* KEYBOARD AREA */}
              <KeyboardArea 
                className="bg-neutral-900 rounded-lg p-1 border border-neutral-700 w-full"
                style={{ flex: KEYBOARD_ROWS_COUNT }}
              >
                <div 
                   className="w-full h-full grid"
                   style={{
                     gridTemplateRows: `repeat(${KEYBOARD_LAYOUT.length}, 1fr)`,
                     gap: '2px'
                   }}
                >
                  {KEYBOARD_LAYOUT.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid w-full h-full gap-[2px]" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
                      {row.map((char) => (
                        <div key={char} className="w-full h-full relative">
                          <DraggableItem
                            id={`keyboard-${char}`}
                            char={char}
                            origin="keyboard"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </KeyboardArea>

            </div>
          </div>

        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragData ? (
            <div 
              style={{ 
                width: dragSize ? dragSize.width : '3rem', 
                height: dragSize ? dragSize.height : '3rem' 
              }}
            >
              <Tile char={activeDragData.char} isOverlay />
            </div>
          ) : null}
        </DragOverlay>

      </div>
    </DndContext>
  );
}