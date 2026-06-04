import React, { createContext, useContext, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: ReturnType<typeof useGetMe>["data"] | undefined;
  isLoading: boolean;
  isError: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  isLoading: true,
  isError: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
    },
  });

  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isError) {
      setLocation("/login");
    }
  }, [isLoading, isError, setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
