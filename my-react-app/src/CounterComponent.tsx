import React, { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";

export function CounterComponent() {
  const [counter, setCounter] = useState(0);

  const handleClick = () => {
    const newCount = counter + 1;
    setCounter(newCount);
    OBR.notification.show(`count is ${newCount}`);
  };

  return (
    <button onClick={handleClick}>
      count is {counter}
    </button>
  );
}