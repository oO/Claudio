import React from "react";
import { ProxySettings } from "@/components/settings";

interface NetworkSettingsProps {
  onProxyChange: (hasChanges: boolean, getSettings: (() => any) | null, save: (() => Promise<void>) | null) => void;
  onToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}

export const NetworkSettings: React.FC<NetworkSettingsProps> = ({
  onProxyChange,
  onToast,
}) => {
  return (
    <ProxySettings 
      setToast={onToast}
      onChange={onProxyChange}
    />
  );
};