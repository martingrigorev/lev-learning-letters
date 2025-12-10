import React, { useState, useCallback, useEffect } from 'react';
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
import { playSound, speakText, initVoices } from './audio';

// Gap in pixels used for both Grid and Keyboard to ensure alignment
const GAP_PX = 2;

// Custom arbitrary grid style
const gridStyle = {
  gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
  gap: `${GAP_PX}px`
};

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
  if (color === 'red') colorClasses = "bg-red-600 border-red-800 hover:bg-red-500 active:border-b-0 active:translate-y-[4px]";
  if (color === 'green') colorClasses = "bg-green-600 border-green-800 hover:bg-green-500 active:border-b-0 active:translate-y-[4px]";
  if (color === 'blue') colorClasses = "bg-blue-600 border-blue-800 hover:bg-blue-500 active:border-b-0 active:translate-y-[4px]";
  
  if (disabled) {
    colorClasses = "bg-gray-600 border-gray-800 opacity-50 cursor-not-allowed";
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative h-12 sm:h-14 flex-1 flex items-center justify-center font-bold text-white rounded shadow-sm select-none border-b-4 transition-all ${colorClasses}`}
    >
      {icon}
      {label && <span className="ml-2 text-xs sm:text-base">{label}</span>}
    </button>
  );
};

function KeyboardArea({ children }: { children?: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: 'keyboard-area',
    data: { type: 'keyboard-area' }
  });
  return (
    <div ref={setNodeRef} className="flex-none bg-neutral-900 rounded-xl p-4 shadow-2xl border border-neutral-700">
      {children}
    </div>
  );
}

// Custom collision detection to handle tight grids better
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCenter(args);
};

// Helper to find connected text (word) in a row around a specific index
const getConnectedWord = (state: GridState, index: number): string => {
  if (!state[index]) return '';

  const row = Math.floor(index / GRID_COLS);
  let start = index;
  let end = index;

  // Scan left
  while (start > 0 && Math.floor((start - 1) / GRID_COLS) === row && state[start - 1]) {
    start--;
  }

  // Scan right
  while (end < TOTAL_CELLS - 1 && Math.floor((end + 1) / GRID_COLS) === row && state[end + 1]) {
    end++;
  }

  let word = '';
  for (let i = start; i <= end; i++) {
    word += state[i].char;
  }
  return word;
};

// Helper to get ALL text from the board, row by row
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

  // Initialize voices on mount
  useEffect(() => {
    initVoices();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      // Reduced delay to make it feel snappier, but tolerance helps prevents accidental drags while scrolling
      activationConstraint: { delay: 100, tolerance: 8 },
    })
  );

  // --- Toolbar Actions ---

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setGridState(previous);
    playSound('rustle');
  };

  const handleClear = () => {
    if (Object.keys(gridState).length === 0) return;
    setHistory(prev => [...prev, gridState]); // Save state before clear
    setGridState({});
    playSound('rustle');
  };

  const handleSpeakAll = () => {
    const text = getAllText(gridState);
    if (text) {
      speakText(text);
    }
  };

  // --- Drag Logic ---

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Mobile Safari "Wake up" hack for audio
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel(); 
    }

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

    // Always play drop sound on release
    playSound('drop');

    if (!over) return;

    // Snapshot for history
    const currentGridState = gridState;

    // Delete Logic
    if (data.origin === 'grid' && over.id === 'keyboard-area') {
       setHistory(prev => [...prev, currentGridState]); // Save history
       setGridState((prev) => {
         const newState = { ...prev };
         if (data.index !== undefined) delete newState[data.index];
         return newState;
       });
       return;
    }

    // Cell Logic
    if (over.id.toString().startsWith('cell-')) {
      const targetIndex = over.data.current?.index as number;

      if (targetIndex !== undefined) {
        // Calculate new state locally to determine speech
        const nextState = { ...gridState };
        const existingItem = nextState[targetIndex];
        let didChange = false;

        // 1. Moving from GRID
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
        // 2. Cloning from KEYBOARD
        else if (data.origin === 'keyboard') {
           const newId = `placed-${data.char}-${Date.now()}-${Math.random()}`;
           nextState[targetIndex] = {
             char: data.char,
             id: newId
           };
           didChange = true;
        }

        if (didChange) {
          setHistory(prev => [...prev, currentGridState]); // Save history
          setGridState(nextState);

          // Speech Logic
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

  // Handler for clicking a grid item
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

  const keyWidthStyle = {
    width: `calc((100% - ${(GRID_COLS - 1) * GAP_PX}px) / ${GRID_COLS})`
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
      autoScroll={false} 
    >
      <div className="min-h-screen bg-neutral-800 flex flex-col items-center py-4 font-sans select-none overflow-hidden">
        
        <div className="w-full max-w-[95vw] lg:max-w-6xl flex flex-col gap-6 h-full flex-1">
          
          {/* TOOLBAR */}
          <div className="flex w-full gap-4 px-1">
            <ToolbarButton 
              color="red" 
              onClick={handleUndo} 
              disabled={history.length === 0}
              label="Назад"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
              }
            />
            <ToolbarButton 
              color="green" 
              onClick={handleClear}
              label="Очистить"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              }
            />
            <ToolbarButton 
              color="blue" 
              onClick={handleSpeakAll}
              label="Произнести"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              }
            />
          </div>

          {/* TOP AREA: Grid */}
          <div className="flex-1 bg-neutral-900 rounded-xl p-2 sm:p-4 shadow-2xl border border-neutral-700 flex flex-col justify-center relative">
            <div 
              className="grid w-full mx-auto"
              style={gridStyle}
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

          {/* BOTTOM AREA: Keyboard */}
          <KeyboardArea>
            <div className="flex flex-col gap-[2px] items-center justify-center w-full">
               
              {KEYBOARD_LAYOUT.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-[2px] justify-center w-full">
                  {row.map((char) => (
                    <div 
                      key={char} 
                      className="aspect-square relative"
                      style={keyWidthStyle}
                    >
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