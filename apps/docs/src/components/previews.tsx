import * as React from "react";
import {
  Accordion,
  Button,
  Checkbox,
  Combobox,
  Dialog,
  DropdownMenu,
  Popover,
  RadioGroup,
  RadioItem,
  Select,
  Switch,
  Tabs,
  ToastProvider,
  ToastViewport,
  Tooltip,
  useToast,
} from "@dsc/react";

function ToastExample() {
  const { toast } = useToast();
  return (
    <>
      <Button
        onClick={() =>
          toast({
            title: "Changes saved",
            description: "This is a demo notification.",
            duration: 4000,
          })
        }
      >
        Show notification
      </Button>
      <ToastViewport className="demo-toast" />
    </>
  );
}
export function ComponentPreview({ name }: { name: string }) {
  const [checked, setChecked] = React.useState(true);
  const [enabled, setEnabled] = React.useState(false);
  const [fruit, setFruit] = React.useState("apple");
  const [clicks, setClicks] = React.useState(0);
  switch (name) {
    case "button":
      return (
        <div className="demo-stack">
          <div className="demo-row">
            <Button onClick={() => setClicks((v) => v + 1)}>
              Primary button
            </Button>
            <Button variant="secondary" onClick={() => setClicks((v) => v + 1)}>
              Secondary
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="demo-caption" role="status">
            {clicks
              ? `Button activated ${clicks} ${clicks === 1 ? "time" : "times"}.`
              : "Click a button, or focus it and press Enter."}
          </p>
        </div>
      );
    case "checkbox":
      return (
        <div className="demo-stack">
          <div className="demo-row">
            <Checkbox
              aria-label="Email updates"
              checked={checked}
              onCheckedChange={setChecked}
            />
            <span>Email updates</span>
          </div>
          <p className="demo-caption" role="status">
            {checked
              ? "Subscribed to email updates"
              : "Email updates turned off"}
          </p>
        </div>
      );
    case "switch":
      return (
        <div className="demo-stack">
          <div className="demo-row">
            <Switch
              aria-label="Notifications"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <span>Notifications</span>
          </div>
          <p className="demo-caption" role="status">
            Notifications are {enabled ? "on" : "off"}.
          </p>
        </div>
      );
    case "dialog":
      return (
        <Dialog.Root>
          <Dialog.Trigger className="ds-button ds-button--primary ds-button--md">
            Open example dialog
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content>
              <Dialog.Title>Ready to make a change?</Dialog.Title>
              <Dialog.Description>
                Try Tab to move between buttons. Press Escape to close and
                return to the trigger.
              </Dialog.Description>
              <div className="dialog-actions">
                <Dialog.Close className="ds-button ds-button--secondary ds-button--md">
                  Cancel
                </Dialog.Close>
                <Dialog.Close className="ds-button ds-button--primary ds-button--md">
                  Got it
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      );
    case "tabs":
      return (
        <div className="demo-tabs">
          <Tabs.Root defaultValue="overview">
            <Tabs.List aria-label="Project information">
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
              <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="overview">
              A shared foundation for every screen.
            </Tabs.Content>
            <Tabs.Content value="activity">
              Your tokens are ready to explore.
            </Tabs.Content>
            <Tabs.Content value="settings">
              Use the theme selector to change the preview.
            </Tabs.Content>
          </Tabs.Root>
        </div>
      );
    case "accordion":
      return (
        <Accordion.Root className="demo-accordion">
          <Accordion.Item value="tokens">
            <Accordion.Trigger>
              What is a design token? <span aria-hidden="true">+</span>
            </Accordion.Trigger>
            <Accordion.Content>
              A named design value, such as a color or spacing, that you reuse
              across your app.
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="themes">
            <Accordion.Trigger>
              How do themes work? <span aria-hidden="true">+</span>
            </Accordion.Trigger>
            <Accordion.Content>
              The same token name resolves to a different value in each theme.
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      );
    case "combobox":
      return (
        <div className="demo-stack">
          <label htmlFor="demo-fruit">Choose a fruit</label>
          <Combobox
            id="demo-fruit"
            options={[
              { value: "apple", label: "Apple" },
              { value: "banana", label: "Banana" },
              { value: "orange", label: "Orange" },
            ]}
            value={fruit}
            onValueChange={setFruit}
          />
          <p className="demo-caption">
            Type to filter, then use arrow keys and Enter to select.
          </p>
        </div>
      );
    case "radio-group":
      return (
        <RadioGroup
          defaultValue="monthly"
          aria-label="Billing period"
          className="demo-row"
        >
          <RadioItem value="monthly" className="demo-radio">
            Monthly
          </RadioItem>
          <RadioItem value="yearly" className="demo-radio">
            Yearly
          </RadioItem>
        </RadioGroup>
      );
    case "tooltip":
      return (
        <div className="demo-tooltip">
          <Tooltip.Root delay={200}>
            <Tooltip.Trigger>
              <button className="ds-button ds-button--secondary ds-button--md">
                Hover or focus me
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className="demo-tooltip-content">
              A little extra context.
            </Tooltip.Content>
          </Tooltip.Root>
        </div>
      );
    case "dropdown-menu":
      return (
        <DropdownMenu.Root>
          <div className="demo-menu-wrap">
            <DropdownMenu.Trigger className="ds-button ds-button--secondary ds-button--md">
              Project actions <span aria-hidden="true">⌄</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              className="demo-menu"
              aria-label="Project actions"
            >
              <DropdownMenu.Item>View project</DropdownMenu.Item>
              <DropdownMenu.Item>Duplicate project</DropdownMenu.Item>
            </DropdownMenu.Content>
          </div>
        </DropdownMenu.Root>
      );
    case "select":
      return (
        <Select.Root defaultValue="light">
          <div className="demo-menu-wrap">
            <Select.Trigger
              aria-label="Example theme"
              className="ds-button ds-button--secondary ds-button--md"
            />
            <Select.Content className="demo-menu" aria-label="Example themes">
              <Select.Item value="light">Light</Select.Item>
              <Select.Item value="dark">Dark</Select.Item>
              <Select.Item value="jaldee">Jaldee</Select.Item>
            </Select.Content>
          </div>
        </Select.Root>
      );
    case "popover":
      return (
        <Popover.Root>
          <Popover.Trigger className="ds-button ds-button--secondary ds-button--md">
            About this preview
          </Popover.Trigger>
          <Popover.Content
            className="demo-popover"
            aria-label="About this preview"
          >
            <strong>A real React component</strong>
            <p>Click outside or press Escape to close this popover.</p>
          </Popover.Content>
        </Popover.Root>
      );
    case "toast":
      return (
        <ToastProvider>
          <ToastExample />
        </ToastProvider>
      );
    default:
      return (
        <p>Explore this component’s tokens and keyboard guidance below.</p>
      );
  }
}
