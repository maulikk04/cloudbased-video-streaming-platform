import { createContext, useContext, useState, useEffect } from "react";

const MyListContext = createContext();

export function MyListProvider({ children }) {
  const [myList, setMyList] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("myList") || "[]");
    setMyList(saved);
  }, []);

  const addToList = (movieId) => {
    const updated = [...myList, movieId];
    localStorage.setItem("myList", JSON.stringify(updated));
    setMyList(updated);
  };

  const removeFromList = (movieId) => {
    const updated = myList.filter((id) => id !== movieId);
    localStorage.setItem("myList", JSON.stringify(updated));
    setMyList(updated);
  };

  return (
    <MyListContext.Provider value={{ myList, addToList, removeFromList }}>
      {children}
    </MyListContext.Provider>
  );
}

export function useMyList() {
  return useContext(MyListContext);
}
