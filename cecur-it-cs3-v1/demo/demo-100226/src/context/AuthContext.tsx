import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { apiRequest, setStoredToken, clearStoredToken, getStoredToken } from '../lib/api';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, handleFirestoreError, OperationType } from '../lib/firebase';

interface RolePermissions {
  role: UserRole;
  allowedPanels: string[];
  allowedActions: string[];
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  displayName: string;
  title?: string;
  department?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  permissions: RolePermissions | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  logout: () => void;
  canAccessPanel: (panelId: string) => boolean;
  canPerformAction: (actionId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize auth: verify existing operator token or require explicit authentication
  const initAuth = useCallback(async () => {
    setLoading(true);
    const existingToken = getStoredToken();

    if (existingToken) {
      try {
        const res = await apiRequest<{ user: User; permissions: RolePermissions }>('/api/auth/me');
        setUser(res.user);
        setPermissions(res.permissions);
      } catch (err) {
        clearStoredToken();
        setUser(null);
        setPermissions(null);
      }
    } else {
      setUser(null);
      setPermissions(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (usernameOrEmail: string, password: string) => {
    const res = await apiRequest<{ token: string; user: User; permissions: RolePermissions }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username: usernameOrEmail, password }),
      }
    );
    setStoredToken(res.token);
    setUser(res.user);
    setPermissions(res.permissions);

    // Sync to Firestore user document asynchronously
    try {
      if (!firestoreDb) return;
      const userRef = doc(firestoreDb, 'users', res.user.id);
      await setDoc(
        userRef,
        {
          id: res.user.id,
          username: res.user.username,
          email: res.user.email,
          role: res.user.role,
          displayName: res.user.displayName,
          title: res.user.title,
          department: res.user.department,
          avatar: res.user.avatar,
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (syncErr) {
      console.warn('Firestore session sync note:', syncErr);
    }
  };

  const register = async (data: RegisterData) => {
    const res = await apiRequest<{ token: string; user: User; permissions: RolePermissions }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );

    // Persist newly registered operator profile into Firestore collection
    try {
      if (!firestoreDb) return;
      const userRef = doc(firestoreDb, 'users', res.user.id);
      await setDoc(
        userRef,
        {
          id: res.user.id,
          username: res.user.username,
          email: res.user.email,
          role: res.user.role,
          displayName: res.user.displayName,
          title: res.user.title,
          department: res.user.department,
          avatar: res.user.avatar,
          createdAt: res.user.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (syncErr) {
      console.warn('Firestore profile registration sync note:', syncErr);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    // Prevent client-side role escalation attempts
    const sanitizedUpdates = { ...updates };
    delete (sanitizedUpdates as any).role;
    delete (sanitizedUpdates as any).id;
    delete (sanitizedUpdates as any).passwordHash;

    const res = await apiRequest<{ user: User; permissions: RolePermissions }>(
      '/api/auth/profile',
      {
        method: 'PATCH',
        body: JSON.stringify(sanitizedUpdates),
      }
    );
    setUser(res.user);
    setPermissions(res.permissions);

    // Update Firestore document
    try {
      if (!firestoreDb) return;
      const userRef = doc(firestoreDb, 'users', res.user.id);
      await setDoc(userRef, sanitizedUpdates, { merge: true });
    } catch (syncErr) {
      console.warn('Firestore profile update sync note:', syncErr);
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
    setPermissions(null);
  };

  const canAccessPanel = (panelId: string): boolean => {
    if (!permissions) return false;
    return permissions.allowedPanels.includes(panelId);
  };

  const canPerformAction = (actionId: string): boolean => {
    if (!permissions) return false;
    return permissions.allowedActions.includes(actionId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        login,
        register,
        updateProfile,
        logout,
        canAccessPanel,
        canPerformAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
