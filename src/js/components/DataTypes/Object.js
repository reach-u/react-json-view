import React from 'react';
import { polyfill } from 'react-lifecycles-compat';
import { toType } from './../../helpers/util';
import dispatcher from './../../helpers/dispatcher';

//data type components
import { JsonObject } from './DataTypes';

import VariableEditor from './../VariableEditor';
import VariableMeta from './../VariableMeta';
import ArrayGroup from './../ArrayGroup';
import ObjectName from './../ObjectName';
import DragWrapper from '../DragWrapper';

import searchStringIndex from './../../helpers/searchStringIndex';
//attribute store
import AttributeStore from './../../stores/ObjectAttributes';

//icons
import { CollapsedIcon, ExpandedIcon } from './../ToggleIcons';
import { Edit } from '../icons';

//theme
import Theme from './../../themes/getStyle';

//increment 1 with each nested object & array
const DEPTH_INCREMENT = 1;
//single indent is 5px
const SINGLE_INDENT = 5;

class RjvObject extends React.PureComponent {
    constructor(props) {
        super(props);
        const state = RjvObject.getState(props);
        this.state = {
            ...state,
            prevProps: {},
            dropTarget: {},
            dragEnabled: true
        };
    }

    static getState = props => {
        const size = Object.keys(props.src).length;
        const expanded =
            (props.collapsed === false ||
                (props.collapsed !== true && props.collapsed > props.depth)) &&
            (!props.shouldCollapse ||
                props.shouldCollapse({
                    name: props.name,
                    src: props.src,
                    type: toType(props.src),
                    namespace: props.namespace
                }) === false) &&
            //initialize closed if object has no items
            size !== 0;
        const searchExpanded = searchStringIndex(JSON.stringify(props.src), props.search);
        const state = {
            expanded: searchExpanded > 0 || AttributeStore.get(
                props.rjvId,
                props.namespace,
                'expanded',
                expanded
            ),
            object_type: props.type === 'array' ? 'array' : 'object',
            parent_type: props.type === 'array' ? 'array' : 'object',
            size
        };
        return state;
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        const { prevProps } = prevState;
        if (!nextProps.jsvRoot) {
            //if src has changed but collapse did not change then remain expanded (as auto expand opens objects/arrays)
            if (prevProps.src !== nextProps.src && prevProps.collapsed === nextProps.collapsed) {
                AttributeStore.set(nextProps.rjvId, nextProps.namespace, 'expanded', true);
            } else {
                //collapse all after depth 1 or expand all
                AttributeStore.set(nextProps.rjvId, nextProps.namespace, 'expanded', (nextProps.collapsed !== 1 && nextProps.collapsed !== true));
            }
        }
        //if changing root then it should always be expanded
        else {
            AttributeStore.set(nextProps.rjvId, nextProps.namespace, 'expanded', true);
        }
        if (nextProps.src !== prevProps.src ||
            nextProps.collapsed !== prevProps.collapsed ||
            nextProps.name !== prevProps.name ||
            nextProps.namespace !== prevProps.namespace ||
            nextProps.rjvId !== prevProps.rjvId
        ) {
            const newState = RjvObject.getState(nextProps);
            return {
                ...newState,
                prevProps: nextProps
            };
        }
        return null;
    }

    toggleCollapsed = () => {
        const { rjvId, namespace } = this.props;
        const { expanded } = this.state;
        const noSelection = window.getSelection && !window.getSelection().toString();
        if (noSelection) {
            this.setState({
                expanded: !expanded
            }, () => {
                AttributeStore.set(
                    rjvId,
                    namespace,
                    'expanded',
                    !expanded
                );
            });
        }
    }

    getObjectContent = (depth, src, props) => {
        return (
            <div class="pushed-content object-container">
                <div
                    class="object-content"
                    { ...Theme(this.props.theme, 'pushed-content') }
                >
                    { this.renderObjectContents(src, props) }
                </div>
            </div>
        );
    }

    getEllipsis = () => {
        const { size } = this.state;

        if (size === 0) {
            //don't render an ellipsis when an object has no items
            return null;
        } else {
            return (
                <div
                    { ...Theme(this.props.theme, 'ellipsis') }
                    class="node-ellipsis"
                    onClick={ this.toggleCollapsed }
                >
                    ...
                </div>
            );
        }
    }

    getObjectMetaData = src => {
        const { size } = this.state;
        return <VariableMeta size={ size } { ...this.props } />;
    }

    getEditIcon = () => {
        const { theme, name, namespace, src, rjvId } = this.props;
        return (
            <div class="click-to-edit" style={{ verticalAlign: 'top' }} title="Edit Key">
                <Edit
                    class="click-to-edit-icon"
                    {...Theme(theme, 'editVarIcon')}
                    onClick={(e) => {
                        e.stopPropagation();
                        dispatcher.dispatch({
                            name: 'UPDATE_VARIABLE_KEY_REQUEST',
                            rjvId: rjvId,
                            data: {
                                name,
                                namespace: namespace.splice(0, namespace.length -1),
                                existing_value: src,
                                _removed: false,
                                key_name: name
                            }
                        });
                    }}
                />
            </div>
        );
    }

    getBraceStart(object_type, expanded) {
        const { src, theme, iconStyle, parent_type } = this.props;

        if (parent_type === 'array_group') {
            return (
                <span>
                    <span {...Theme(theme, 'brace')}>
                        {object_type === 'array' ? '[' : '{'}
                    </span>
                    {expanded ? this.getObjectMetaData(src) : null}
                </span>
            );
        }

        const IconComponent = expanded ? ExpandedIcon : CollapsedIcon;

        return (
            <span>
                <span
                    onClick={e => {
                        this.toggleCollapsed();
                    }}
                    {...Theme(theme, 'brace-row')}
                >
                    { this.getEditIcon() }
                    <div
                        class="icon-container"
                        {...Theme(theme, 'icon-container')}
                    >
                        <IconComponent {...{ theme, iconStyle }} />
                    </div>
                    <ObjectName {...this.props} />
                    <span {...Theme(theme, 'brace')}>
                        {object_type === 'array' ? '[' : '{'}
                    </span>
                </span>
                { expanded ? this.getObjectMetaData(src) : null }
            </span>
        );
    }

    render() {
        // `indentWidth` and `collapsed` props will
        // perpetuate to children via `...rest`
        const {
            depth,
            src,
            namespace,
            name,
            type,
            parent_type,
            theme,
            jsvRoot,
            iconStyle,
            ...rest
        } = this.props;

        const { object_type, expanded } = this.state;

        let styles = {};
        if (!jsvRoot && parent_type !== 'array_group') {
            styles.paddingLeft = this.props.indentWidth * SINGLE_INDENT;
        } else if (parent_type === 'array_group') {
            styles.borderLeft = 0;
            styles.display = 'inline';
        }

        return (
            <div
                class='object-key-val'
                {...Theme(theme, jsvRoot ? 'jsv-root' : 'objectKeyVal', styles)}
            >
                { this.getBraceStart(object_type, expanded) }
                { expanded
                    ? this.getObjectContent(depth, src, {
                        theme,
                        iconStyle,
                        ...rest
                    })
                    : this.getEllipsis() }
                <span class="brace-row">
                    <span
                        style={ {
                            ...Theme(theme, 'brace').style,
                            paddingLeft: expanded ? '3px' : '0px'
                        } }
                    >
                        { object_type === 'array' ? ']' : '}' }
                    </span>
                    { expanded ? null : this.getObjectMetaData(src) }
                </span>
            </div>
        );
    }

    handleDragAllow = (allowToDrag) => {
        this.setState({
            dragEnabled: allowToDrag
        });
    }

    renderObjectContents = (variables, props) => {
        const {
            depth,
            parent_type,
            index_offset,
            groupArraysAfterLength,
            namespace,
            src,
            type,
            sortKeys,
            rjvId
        } = this.props;
        const {
            object_type,
            dropTarget,
            dragEnabled
        } = this.state;
        let theme = props.theme;
        let elements = [],
            variable;
        let keys = Object.keys(variables || {});
        if (sortKeys) {
            keys = keys.sort();
        }
        keys.forEach((name, index) => {
            variable = new JsonVariable(name, variables[name]);

            if (parent_type === 'array_group' && index_offset) {
                variable.name = parseInt(variable.name) + index_offset;
            }
            if (!variables.hasOwnProperty(name)) {
                return;
            } else if (variable.type === 'object') {
                elements.push(
                    <DragWrapper
                        key={ variable.name }
                        name={ variable.name }
                        value={ variable.value }
                        dropMarker={ index === keys.length - 1 ? 'drop-after' : 'drop-before' }
                        dropTarget={ dropTarget }
                        depth={ depth }
                        namespace={ namespace }
                        rjvId={ rjvId }
                        src={ src }
                        dragAllowed={ dragEnabled }
                        canDrop={ true }>
                        <JsonObject
                            key={ variable.name }
                            depth={ depth + DEPTH_INCREMENT }
                            name={ variable.name }
                            src={ variable.value }
                            type={ variable.type }
                            namespace={ namespace.concat(variable.name) }
                            parent_type={ object_type }
                            { ...props }
                        />
                    </DragWrapper>
                );
            } else if (variable.type === 'array') {
                let ObjectComponent = JsonObject;

                if (
                    groupArraysAfterLength &&
                    variable.value.length > groupArraysAfterLength
                ) {
                    ObjectComponent = ArrayGroup;
                }

                elements.push(
                    <DragWrapper
                        key={ variable.name }
                        name={ variable.name }
                        value={ variable.value }
                        dropMarker={ index === keys.length - 1 ? 'drop-after' : 'drop-before' }
                        dropTarget={ dropTarget }
                        depth={ depth }
                        namespace={ namespace }
                        rjvId={ rjvId }
                        src={ src }
                        dragAllowed={ dragEnabled }
                        isArray={ true }
                        canDrop={ true }>
                        <ObjectComponent
                            key={ variable.name }
                            depth={ depth + DEPTH_INCREMENT }
                            name={ variable.name }
                            src={ variable.value }
                            namespace={ namespace.concat(variable.name) }
                            type="array"
                            parent_type={ object_type }
                            { ...props }
                        />
                    </DragWrapper>
                );
            } else {
                elements.push(
                    <DragWrapper
                        key={ variable.name }
                        name={ variable.name }
                        value={ variable.value }
                        dropMarker={ index === keys.length - 1 ? 'drop-after' : 'drop-before' }
                        dropTarget={ dropTarget }
                        depth={ depth }
                        namespace={ namespace }
                        rjvId={ rjvId }
                        src={ src }
                        dragAllowed={ dragEnabled }
                        canDrop={ true }>
                        <VariableEditor
                            key={ variable.name + '_' + namespace }
                            src={ src }
                            variable={ variable }
                            depth={ depth }
                            singleIndent={ SINGLE_INDENT }
                            namespace={ namespace }
                            type={ type }
                            parent_type={ object_type }
                            isDragAllowed={ this.handleDragAllow }
                            { ...props } />
                    </DragWrapper>
                );
            }
        });
        return elements;
    }
}

//just store name, value and type with a variable
class JsonVariable {
    constructor(name, value) {
        this.name = name;
        this.value = value;
        this.type = toType(value);
    }
}

polyfill(RjvObject);

//export component
export default RjvObject;
