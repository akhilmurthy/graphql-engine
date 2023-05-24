import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { z } from 'zod';
import { AdvancedSelectField, SimpleForm, useConsoleForm } from '.';
import { screen, userEvent, within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

export default {
  title: 'components/Forms 📁/Advanced Select Field 🧬',
  component: AdvancedSelectField,
  parameters: {
    docs: {
      source: { type: 'code' },
    },
  },
} as ComponentMeta<typeof AdvancedSelectField>;

export const Basic: ComponentStory<typeof AdvancedSelectField> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', disabled: true },
    { value: 'value2', label: 'Value 2' },
  ];

  const validationSchema = z.object({});

  return (
    <SimpleForm schema={validationSchema} onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        options={options}
      />
    </SimpleForm>
  );
};
Basic.storyName = '🧰 Basic';
Basic.parameters = {
  docs: {
    source: { state: 'open' },
  },
};

export const VariantWithDescription: ComponentStory<
  typeof AdvancedSelectField
> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', disabled: true },
    { value: 'value2', label: 'Value 2' },
  ];

  const validationSchema = z.object({});

  return (
    <SimpleForm schema={validationSchema} onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        description="Select description"
        options={options}
      />
    </SimpleForm>
  );
};
VariantWithDescription.storyName = '🎭 Variant - With description';
VariantWithDescription.parameters = {
  docs: {
    source: { state: 'open' },
  },
};
VariantWithDescription.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  // Verify description is present
  expect(canvas.getByText('Select description')).toBeInTheDocument();
};

export const VariantWithTooltip: ComponentStory<
  typeof AdvancedSelectField
> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', disabled: true },
    { value: 'value2', label: 'Value 2' },
  ];

  const validationSchema = z.object({});

  return (
    <SimpleForm schema={validationSchema} onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        tooltip="Select tooltip"
        options={options}
      />
    </SimpleForm>
  );
};
VariantWithTooltip.storyName = '🎭 Variant - With tooltip';
VariantWithTooltip.parameters = {
  // The visual screenshot is not stable. Sometimes the tooltip is slightly to the right, sometimes
  // not. This is not good and would require more investigation (is it a tooltip problem? Is is a
  // parent problem? A CSS conflict? Does it happens only in Storybook?) but it's a blocker for the
  // current PR (getting Chromatic a required step for merging) and we need to fix it quick.
  // Ignoring the element through data-chromatic="ignore" could now be the right solution right now
  // since the tooltip DOM element is outside of the parent.
  chromatic: { disableSnapshot: true },

  docs: {
    source: { state: 'open' },
  },
};
VariantWithTooltip.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // Hover on tooltip
  await userEvent.hover(await canvas.findByTestId('tooltip-trigger'));

  // Verify tooltip is present
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
};

export const StateWithDefaultValue: ComponentStory<
  typeof AdvancedSelectField
> = () => {
  const options = [
    { value: { name: 'value0' }, label: 'Value 0' },
    { value: { name: 'value1' }, label: 'Value 1', disabled: true },
    { value: { name: 'value2' }, label: 'Value 2' },
  ];

  const defaultValues = {
    selectNames: [{ value: { name: 'value2' }, label: 'Value 2' }],
  };

  const validationSchema = z.object({});

  return (
    <SimpleForm
      schema={validationSchema}
      options={{ defaultValues }}
      onSubmit={action('onSubmit')}
    >
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        options={options}
      />
    </SimpleForm>
  );
};
StateWithDefaultValue.storyName = '🔁 State - With default value';
StateWithDefaultValue.parameters = {
  docs: {
    description: {
      story: `Use \`<SimpleForm>\` options to set default value.`,
    },
    source: { state: 'open' },
  },
};
StateWithDefaultValue.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // Verify default value is selected
  expect(canvas.getByText('Value 2')).toBeInTheDocument();
};

export const StateLoading: ComponentStory<typeof AdvancedSelectField> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', loading: true },
    { value: 'value2', label: 'Value 2' },
  ];

  const validationSchema = z.object({});

  return (
    <SimpleForm schema={validationSchema} onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        options={options}
        loading
      />
    </SimpleForm>
  );
};
StateLoading.storyName = '🔁 State - Loading';
StateLoading.parameters = {
  docs: {
    source: { state: 'open' },
  },
};

export const StateDisabled: ComponentStory<typeof AdvancedSelectField> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', disabled: true },
    { value: 'value2', label: 'Value 2' },
  ];

  const validationSchema = z.object({});

  return (
    <SimpleForm schema={validationSchema} onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        options={options}
        disabled
      />
    </SimpleForm>
  );
};
StateDisabled.storyName = '🔁 State - Disabled';
StateDisabled.parameters = {
  docs: {
    source: { state: 'open' },
  },
};
StateDisabled.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  const disabledSelect = await canvas.findByText('Select...');

  // Verify select has pointer-events: none
  expect(disabledSelect).toHaveStyle('pointer-events: none');
};

export const StateWithErrorMessage: ComponentStory<
  typeof AdvancedSelectField
> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', disabled: true },
    { value: 'value2', label: 'Value 2' },
  ];

  const schema = z.object({
    selectNames: z
      .array(
        z.object({
          value: z.enum(['value0', 'value2']),
          label: z.string(),
          disabled: z.boolean().optional(),
        })
      )
      .min(1),
  });

  const {
    methods: { trigger },
    Form,
  } = useConsoleForm({
    schema,
  });

  React.useEffect(() => {
    // Use useEffect hook to wait for the form to be rendered before triggering validation
    void trigger('selectNames');
  }, []);

  return (
    <Form onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="The select label"
        options={options}
      />
    </Form>
  );
};
StateWithErrorMessage.storyName = '🔁 State - With error message';
StateWithErrorMessage.parameters = {
  docs: {
    description: {
      story: `Incorrect value is set then \`<SimpleForm>\` validation is automatically triggered.`,
    },
    source: { state: 'open' },
  },
};
StateWithErrorMessage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // Verify error message is displayed
  expect(await canvas.findByText('Required')).toBeInTheDocument();
};

export const TestingScalability: ComponentStory<
  typeof AdvancedSelectField
> = () => {
  const options = [
    { value: 'value0', label: 'Value 0' },
    { value: 'value1', label: 'Value 1', disabled: true },
    { value: 'value2', label: 'Value 2' },
    {
      value: 'value3',
      label:
        'Value 4 - Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
  ];

  const validationSchema = z.object({});

  return (
    <SimpleForm schema={validationSchema} onSubmit={action('onSubmit')}>
      <AdvancedSelectField
        name="selectNames"
        label="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        tooltip="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        options={options}
      />
    </SimpleForm>
  );
};
TestingScalability.storyName = '🧪 Testing - Scalability';
TestingScalability.parameters = {
  docs: {
    source: { state: 'open' },
  },
};
