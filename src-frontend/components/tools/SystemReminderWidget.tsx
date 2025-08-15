import React from "react";
import { Info, AlertCircle } from "lucide-react";
import { ToolWidgetTemplate } from "./ToolWidgetTemplate";

/**
 * Widget for displaying system reminders (instead of raw XML)
 */
export const SystemReminderWidget: React.FC<{ message: string }> = ({ message }) => {
  // Determine icon and title based on message content
  let IconComponent = Info;
  let title = "System Reminder";
  
  if (message.toLowerCase().includes("warning")) {
    IconComponent = AlertCircle;
    title = "System Warning";
  } else if (message.toLowerCase().includes("error")) {
    IconComponent = AlertCircle;
    title = "System Error";
  }
  
  return (
    <ToolWidgetTemplate>
      <ToolWidgetTemplate.Debug label="SystemReminderWidget" />
      <ToolWidgetTemplate.Header icon={IconComponent} title={title} />
      <ToolWidgetTemplate.PlainOutput>
        <div className="text-sm">{message}</div>
      </ToolWidgetTemplate.PlainOutput>
    </ToolWidgetTemplate>
  );
};