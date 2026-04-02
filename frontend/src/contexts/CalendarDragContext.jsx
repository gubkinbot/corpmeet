import { createContext, useContext, useState } from "react";

const CalendarDragContext = createContext({ drag: null, setDrag: () => {} });

export function CalendarDragProvider({ children }) {
  const [drag, setDrag] = useState(null);
  return (
    <CalendarDragContext.Provider value={{ drag, setDrag }}>
      {children}
    </CalendarDragContext.Provider>
  );
}

export const useCalendarDrag = () => useContext(CalendarDragContext);
