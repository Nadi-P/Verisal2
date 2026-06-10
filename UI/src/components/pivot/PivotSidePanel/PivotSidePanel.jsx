import React from 'react';
import { createPortal } from 'react-dom';
import { usePivotSidePanelLogic } from './PivotSidePanel.logic.jsx';
import TopBar                  from './TopBar/TopBar.jsx';
import EditPresetScreen        from './EditPresetScreen/EditPresetScreen.jsx';
import TableEditScreen         from './TableEditScreen/TableEditScreen.jsx';
import ManagePresetsScreen     from './ManagePresetsScreen/ManagePresetsScreen.jsx';
import FieldConfigScreen       from './FieldConfigScreen/FieldConfigScreen.jsx';
import TableFieldConfigScreen  from './TableFieldConfigScreen/TableFieldConfigScreen.jsx';
import ConfirmDialog           from './ConfirmDialog/ConfirmDialog.jsx';
import SaveDialog              from './SaveDialog/SaveDialog.jsx';
import RenameDialog            from './RenameDialog/RenameDialog.jsx';
import './PivotSidePanel.css';

/**
 * Pivot side panel orchestrator.
 *
 * Renders the TopBar and a single screen at a time, with slide+fade
 * transitions between screens (forward / back direction).
 *
 * Dialogs portal into `.report-page-main` so they sit centered over the
 * table — TopBar stays outside the overlay and remains interactive.
 */
export default function PivotSidePanel(props) {
  const {
    // Open/closed state (lifted to parent)
    isOpen,
    setIsOpen,
    // Display mode: 'pivot' (default) | 'table'. Routes the EDIT + FIELD_CONFIG
    // screens to their pivot- or table-mode variants. ManagePresetsScreen is
    // shared as-is.
    displayMode = 'pivot',
    // Data + config
    allFields,
    uniqueValuesFor,
    config,
    onConfigChange,
    savedPresets,
    defaultName,
    appliedName,
    // Operations
    onOverrideCurrent,
    onSaveNamed,
    onLoadPreset,
    onDeletePreset,
    onRenamePreset,
    onResetToDefault,
    onSetAsDefault,
    showToast,
  } = props;

  const L = usePivotSidePanelLogic({
    isOpen,
    setIsOpen,
    defaultName,
    appliedName,
    savedPresets,
    config,
    onOverrideCurrent,
    onSaveNamed,
    onLoadPreset,
    onDeletePreset,
    onRenamePreset,
    onResetToDefault,
    onSetAsDefault,
    showToast,
  });

  // Render a single screen by name. Used for both the leaving and the
  // entering layers during transitions, so each screen renders with the
  // SAME props it would otherwise. FieldConfig may animate out after its
  // editingField is gone — we guard for that to avoid a render crash.
  const renderScreen = (screenName) => {
    if (screenName === L.SCREENS.EDIT) {
      // The mode-keyed wrapper triggers a CSS fade-in-from-right animation
      // whenever `displayMode` flips, so the EDIT screen feels like a
      // forward-direction screen transition without involving the existing
      // screen-stage outgoing/incoming machinery.
      const editContent = displayMode === 'table' ? (
        <TableEditScreen
          allFields={allFields}
          uniqueValuesFor={uniqueValuesFor}
          config={config}
          onConfigChange={onConfigChange}
          appliedName={appliedName}
          onOpenFieldConfig={L.openFieldConfig}
        />
      ) : (
        <EditPresetScreen
          allFields={allFields}
          uniqueValuesFor={uniqueValuesFor}
          config={config}
          onConfigChange={onConfigChange}
          appliedName={appliedName}
          onOpenFieldConfig={L.openFieldConfig}
        />
      );
      return (
        <div key={`edit-${displayMode}`} className="pivot-side-panel-mode-frame">
          {editContent}
        </div>
      );
    }
    if (screenName === L.SCREENS.MANAGE) {
      return (
        <ManagePresetsScreen
          savedPresets={savedPresets}
          appliedName={appliedName}
          defaultName={defaultName}
          onBack={L.goBack}
          onApply={L.requestApply}
          onDelete={L.requestDelete}
          onRename={L.requestRename}
          onSetAsDefault={L.requestSetAsDefault}
        />
      );
    }
    if (screenName === L.SCREENS.FIELD_CONFIG && L.editingField) {
      const fcContent = displayMode === 'table' ? (
        <TableFieldConfigScreen
          field={L.editingField.field}
          config={config}
          onConfigChange={onConfigChange}
          uniqueValuesFor={uniqueValuesFor}
        />
      ) : (
        <FieldConfigScreen
          field={L.editingField.field}
          zone={L.editingField.zone}
          config={config}
          onConfigChange={onConfigChange}
          uniqueValuesFor={uniqueValuesFor}
          onBack={L.goBack}
        />
      );
      return (
        <div key={`fc-${displayMode}`} className="pivot-side-panel-mode-frame">
          {fcContent}
        </div>
      );
    }
    return null;
  };

  // Always render the aside — when closed, CSS animates width → 0 (slide out).
  // No visible handle when closed; clicking the table area reopens it (logic
  // hook owns that listener).
  const mainEl = typeof document !== 'undefined'
    ? document.querySelector('.report-page-main')
    : null;

  return (
    <>
      <aside
        className={`pivot-side-panel ${L.isOpen ? '' : 'is-closed'}`}
        aria-hidden={!L.isOpen}
      >
        <div className="pivot-side-panel-body">
          <TopBar
            onClose={L.handleClose}
            onReset={L.handleReset}
            onSave={L.handleSave}
            onManage={L.handleManage}
            onBack={L.goBack}
            showBack={L.screen !== L.SCREENS.EDIT}
            resetDisabled={!L.isModified}
          />

          {/* Screen stage — during a transition we render both the outgoing
              and the incoming screens layered with absolute positioning, so
              the OUT animation and IN animation can play simultaneously. */}
          <div
            className="pivot-side-panel-screen-stage"
            data-direction={L.direction}
          >
            {L.outgoingScreen && (
              <div
                key={`out-${L.outgoingScreen}`}
                className="pivot-side-panel-screen is-leaving"
              >
                {renderScreen(L.outgoingScreen)}
              </div>
            )}
            <div
              key={`in-${L.screen}`}
              className="pivot-side-panel-screen is-entering"
            >
              {renderScreen(L.screen)}
            </div>
          </div>
        </div>
      </aside>

      {/* Dialogs portal into the content area so they sit centered above the table */}
      {L.dialog && mainEl && createPortal(
        L.dialog.kind === 'confirm' ? (
          <ConfirmDialog
            {...L.dialog.props}
            onCancel={() => { L.dialog.props.onCancel?.(); L.dismissDialog(true); }}
          />
        ) : L.dialog.kind === 'rename' ? (
          <RenameDialog
            {...L.dialog.props}
            onCancel={() => { L.dialog.props.onCancel?.(); L.dismissDialog(true); }}
          />
        ) : (
          <SaveDialog
            {...L.dialog.props}
            onCancel={() => { L.dialog.props.onCancel?.(); L.dismissDialog(true); }}
          />
        ),
        mainEl,
      )}
    </>
  );
}
