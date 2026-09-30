import React from "react";

type HomeDrawerVisibilityContextValue = {
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
};

const HomeDrawerVisibilityContext = React.createContext<HomeDrawerVisibilityContextValue>({
  visible: false,
  setVisible: () => undefined,
});

export const HomeDrawerVisibilityProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [visible, setVisible] = React.useState(false);
  const value = React.useMemo(() => ({ visible, setVisible }), [visible]);

  return (
    <HomeDrawerVisibilityContext.Provider value={value}>
      {children}
    </HomeDrawerVisibilityContext.Provider>
  );
};

export const useHomeDrawerVisibility = () =>
  React.useContext(HomeDrawerVisibilityContext);
