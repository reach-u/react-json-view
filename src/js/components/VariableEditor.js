import React from 'react';
import AutosizeTextarea from 'react-textarea-autosize';

import dispatcher from './../helpers/dispatcher';
import parseInput from './../helpers/parseInput';
import stringifyVariable from './../helpers/stringifyVariable';
import CopyToClipboard from './CopyToClipboard';
import highlightedString from './../helpers/highlightedString';

//data type components
import {
    JsonBoolean,
    JsonDate,
    JsonFloat,
    JsonFunction,
    JsonInteger,
    JsonNan,
    JsonNull,
    JsonRegexp,
    JsonString,
    JsonUndefined,
    JsonColor
} from './DataTypes/DataTypes';

//clibboard icon
import { Edit, CheckCircle, RemoveIcon as Remove, CancelIcon as Cancel } from './icons';

//theme
import Theme from './../themes/getStyle';

class VariableEditor extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            editMode: false,
            editValue: '',
            renameKey: false,
            parsedInput: {
                type: false,
                value: null
            },
            allowDragging: true
        };
    }
    
    renderArrayKeys = () => {
        const { displayArrayKey, variable, namespace, theme } = this.props;
        return (displayArrayKey ?
            <span
                {...Theme(theme, 'array-key')}
                key={variable.name + '_' + namespace}
            >
                {variable.name}
                <div {...Theme(theme, 'colon')}>:</div>
            </span> : null);
    }

    render() {
        const {
            variable,
            src,
            singleIndent,
            type,
            theme,
            namespace,
            indentWidth,
            enableClipboard,
            onEdit,
            onDelete,
            onSelect,
            rjvId,
            search,
            quotesOnKeys,
            displayArrayKey
        } = this.props;
        const { editMode } = this.state;

        let variableName = variable.name;
        if (typeof variableName === 'string' && search && type !== 'array') {
            const start = (variableName).indexOf(search);
            if (start > -1) {
                variableName = highlightedString(variable.name, start, search.length, theme);
            }
        }

        return (
            <div
                {...Theme(theme, 'objectKeyVal', {
                    paddingLeft: indentWidth * singleIndent
                })}
                class="variable-row"
                key={variable.name}
            >
                {type === 'array' ?
                    this.renderArrayKeys() : (
                        <span>
                            <span
                                {...Theme(theme, 'object-name')}
                                class="object-key"
                                key={variable.name + '_' + namespace}
                            >
                                { !!quotesOnKeys && <span style={{verticalAlign:'top'}}>"</span> }
                                <span style={{ display: 'inline-block' }}>
                                    {variableName}
                                </span>
                                { !!quotesOnKeys && <span style={{verticalAlign:'top'}}>"</span> }
                            </span>
                            <span { ...Theme(theme, 'colon') }>:</span>
                        </span>
                    )
                }
                <div
                    class="variable-value"
                    onClick={
                        onSelect === false && onEdit === false
                            ? null
                            : e => {
                                let location = [...namespace];
                                if ((e.ctrlKey || e.metaKey) && onEdit !== false) {
                                    this.prepopInput(variable);
                                } else if (onSelect !== false) {
                                    location.shift();
                                    onSelect({
                                        ...variable,
                                        namespace: location
                                    });
                                }
                            }
                    }
                    {...Theme(theme, 'variableValue', {
                        cursor: onSelect === false ? 'default' : 'pointer'
                    })}
                >
                    {this.getValue(variable, editMode)}
                </div>
                {enableClipboard ? (
                    <CopyToClipboard
                        hidden={editMode}
                        src={variable.value}
                        clickCallback={enableClipboard}
                        {...{ theme, namespace }}
                    />
                ) : null}
                {onEdit !== false && editMode == false
                    ? this.getEditIcon()
                    : null}
                {onDelete !== false && editMode == false
                    ? this.getRemoveIcon()
                    : null}
            </div>

        );
    }

    getEditIcon = () => {
        const { variable, theme } = this.props;

        return (
            <div class="click-to-edit" style={{ verticalAlign: 'top' }}>
                <Edit
                    class="click-to-edit-icon"
                    {...Theme(theme, 'editVarIcon')}
                    onClick={() => {
                        this.prepopInput(variable);
                    }}
                />
            </div>
        );
    }

    prepopInput = variable => {
        this.props.isDragAllowed(false);
        if (this.props.onEdit !== false) {
            const stringifiedValue = stringifyVariable(variable.value);
            const detected = parseInput(stringifiedValue);
            this.setState({
                editMode: true,
                editValue: stringifiedValue,
                parsedInput: {
                    type: detected.type,
                    value: detected.value
                }
            });
        }
    }

    getRemoveIcon = () => {
        const { variable, namespace, theme, rjvId } = this.props;

        return (
            <div class="click-to-remove" style={ { verticalAlign: 'top' } }>
                <Remove
                    class="click-to-remove-icon"
                    { ...Theme(theme, 'removeVarIcon') }
                    onClick={() => {
                        dispatcher.dispatch({
                            name: 'VARIABLE_REMOVED',
                            rjvId: rjvId,
                            data: {
                                name: variable.name,
                                namespace: namespace,
                                existing_value: variable.value,
                                variable_removed: true
                            }
                        });
                    }}
                />
            </div>
        );
    }

    getValue = (variable, editMode) => {
        const type = editMode ? false : variable.type;
        const { props } = this;
        switch (type) {
        case false:
            return this.getEditInput();
        case 'string':
            return <JsonString value={ variable.value } { ...props } />;
        case 'integer':
            return <JsonInteger value={ variable.value } { ...props } />;
        case 'float':
            return <JsonFloat value={ variable.value } { ...props } />;
        case 'boolean':
            return <JsonBoolean value={ variable.value } { ...props } />;
        case 'function':
            return <JsonFunction value={ variable.value } { ...props } />;
        case 'null':
            return <JsonNull { ...props } />;
        case 'nan':
            return <JsonNan { ...props } />;
        case 'undefined':
            return <JsonUndefined { ...props } />;
        case 'date':
            return <JsonDate value={ variable.value } { ...props } />;
        case 'regexp':
            return <JsonRegexp value={ variable.value } { ...props } />;
        case 'color':
            return <JsonColor
                value={ variable.value }
                handleChange={ this.submitEdit }
                isOneColorPickerOpen={ this.toggleColorEditor }
                colorType={ this.chooseColorCodeType(variable.value) }
                { ...props }/>;
        default:
            // catch-all for types that weren't anticipated
            return (
                <div class="object-value">
                    { JSON.stringify(variable.value) }
                </div>
            );
        }
    }

    getEditInput = () => {
        const { theme } = this.props;
        const { editValue } = this.state;

        return (
            <div>
                <AutosizeTextarea
                    type="text"
                    inputRef={input => input && input.focus()}
                    value={editValue}
                    class="variable-editor"
                    onChange={event => {
                        const value = event.target.value;
                        const detected = parseInput(value);
                        this.setState({
                            editValue: value,
                            parsedInput: {
                                type: detected.type,
                                value: detected.value
                            }
                        });
                    }}
                    onKeyDown={e => {
                        switch (e.key) {
                        case 'Escape': {
                            this.setState({
                                editMode: false,
                                editValue: ''
                            });
                            this.props.isDragAllowed(true);
                            break;
                        }
                        case 'Enter': {
                            if (e.ctrlKey || e.metaKey) {
                                this.submitEdit(true);
                            }
                            this.props.isDragAllowed(true);
                            break;
                        }
                        }
                        e.stopPropagation();
                    }}
                    placeholder="update this value"
                    { ...Theme(theme, 'edit-input') }
                />
                <div { ...Theme(theme, 'edit-icon-container') }>
                    <Cancel
                        class="edit-cancel"
                        { ...Theme(theme, 'cancel-icon') }
                        onClick={() => {
                            this.setState({ editMode: false, editValue: '' });
                            this.props.isDragAllowed(true);
                        }}
                    />
                    <CheckCircle
                        class="edit-check string-value"
                        { ...Theme(theme, 'check-icon') }
                        onClick={() => {
                            this.submitEdit();
                        }}
                    />
                    <div>{ this.showDetected() }</div>
                </div>
            </div>
        );
    }

    toggleColorEditor = (isColorPickerOpen) => {
        this.props.isDragAllowed(isColorPickerOpen);
        this.setState({
            allowDragging: isColorPickerOpen
        });
    }

    chooseColorCodeType = (colorCode) => {
        if (colorCode.substring(0,1) === '#') {
            return 'hex';
        } else if (colorCode.substring(0,4) === 'rgba') {
            return 'rgba';
        } else if (colorCode.substring(0,3) === 'rgb') {
            return 'rgb';
        } else if (colorCode.substring(0,4) === 'hsla') {
            return 'hsla';
        } else if (colorCode.substring(0,3) === 'hsl') {
            return 'hsl';
        }
        return 'hex';
    }

    submitEdit = submit_detected => {
        const { allowDragging } = this.state;
        let newColor;
        if (submit_detected !== undefined && submit_detected['newColorValue']) {
            newColor = submit_detected['newColorValue'];
        }
        const { variable, namespace, rjvId } = this.props;
        const { editValue, parsedInput } = this.state;
        let new_value = editValue;
        if (submit_detected && parsedInput.type) {
            new_value = parsedInput.value;
        }
        if (newColor) {
            new_value = newColor;
        }
        this.setState({
            editMode: false
        });
        if (allowDragging) {
            this.props.isDragAllowed(true);
        }
        dispatcher.dispatch({
            name: 'VARIABLE_UPDATED',
            rjvId: rjvId,
            data: {
                name: variable.name,
                namespace: namespace,
                existing_value: variable.value,
                new_value: new_value,
                variable_removed: false
            }
        });
    }

    showDetected = () => {
        const { theme, variable, namespace, rjvId } = this.props;
        const { type, value } = this.state.parsedInput;
        const detected = this.getDetectedInput();
        if (detected) {
            return (
                <div>
                    <div {...Theme(theme, 'detected-row')}>
                        {detected}
                        <CheckCircle
                            class="edit-check detected"
                            style={{
                                verticalAlign: 'top',
                                paddingLeft: '3px',
                                ...Theme(theme, 'check-icon').style
                            }}
                            onClick={() => {
                                this.submitEdit(true);
                            }}
                        />
                    </div>
                </div>
            );
        }
    }

    getDetectedInput = () => {
        const { parsedInput } = this.state;
        const { type, value } = parsedInput;
        const { props } = this;
        const { theme } = props;

        if (type !== false) {
            switch (type.toLowerCase()) {
            case 'object':
                return (
                    <span>
                        <span
                            style={{
                                ...Theme(theme, 'brace').style,
                                cursor: 'default'
                            }}
                        >
                            {'{'}
                        </span>
                        <span
                            style={{
                                ...Theme(theme, 'ellipsis').style,
                                cursor: 'default'
                            }}
                        >
                                ...
                        </span>
                        <span
                            style={{
                                ...Theme(theme, 'brace').style,
                                cursor: 'default'
                            }}
                        >
                            {'}'}
                        </span>
                    </span>
                );
            case 'array':
                return (
                    <span>
                        <span
                            style={{
                                ...Theme(theme, 'brace').style,
                                cursor: 'default'
                            }}
                        >
                            {'['}
                        </span>
                        <span
                            style={{
                                ...Theme(theme, 'ellipsis').style,
                                cursor: 'default'
                            }}
                        >
                                ...
                        </span>
                        <span
                            style={{
                                ...Theme(theme, 'brace').style,
                                cursor: 'default'
                            }}
                        >
                            {']'}
                        </span>
                    </span>
                );
            case 'string':
                return <JsonString value={value} {...props} />;
            case 'integer':
                return <JsonInteger value={value} {...props} />;
            case 'float':
                return <JsonFloat value={value} {...props} />;
            case 'boolean':
                return <JsonBoolean value={value} {...props} />;
            case 'function':
                return <JsonFunction value={value} {...props} />;
            case 'null':
                return <JsonNull {...props} />;
            case 'nan':
                return <JsonNan {...props} />;
            case 'undefined':
                return <JsonUndefined {...props} />;
            case 'date':
                return <JsonDate value={new Date(value)} {...props} />;
            }
        }
    }
}

//export component
export default VariableEditor;
