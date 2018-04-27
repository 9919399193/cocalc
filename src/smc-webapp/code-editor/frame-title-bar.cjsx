###
FrameTitleBar - title bar in a frame, in the frame tree
###

{debounce} = require('underscore')
{ButtonGroup, Button, DropdownButton, MenuItem}   = require('react-bootstrap')
{Fragment, React, rclass, rtypes, redux} = require('../smc-react')
{Icon, Space, Tip, VisibleMDLG,
 EditorFileInfoDropdown}= require('../r_misc')
{UncommittedChanges}    = require('../jupyter/uncommitted-changes')


{IS_TOUCH, IS_IPAD} = require('../feature')
misc       = require('smc-util/misc')

util = require('./util')

title_bar_style =
    background : '#ddd'
    border     : '1px solid rgb(204,204,204)'
    padding    : '1px'

path_style =
    whiteSpace   : 'nowrap'
    fontSize     : '13px'
    paddingRight : '15px'
    color        : '#333'
    float        : 'right'

TITLE_STYLE =
    padding  : '5px 0 0 5px'
    color    : '#333'
    fontSize : '10pt'
    display  : 'inline-block'
    float    : 'right'

ICON_STYLE =
    width: '20px'
    display: 'inline-block'

button_size = 'small'
if IS_TOUCH
    close_style = undefined
else
    close_style =
        background  : 'transparent'
        borderColor : 'transparent'

exports.FrameTitleBar = rclass
    displayName: 'CodeEditor-FrameTitleBar'

    propTypes :
        actions                 : rtypes.object.isRequired
        path                    : rtypes.string  # assumed to not change for now
        project_id              : rtypes.string  # assumed to not change for now
        active_id               : rtypes.string
        id                      : rtypes.string
        deletable               : rtypes.bool
        read_only               : rtypes.bool
        has_unsaved_changes     : rtypes.bool
        has_uncommitted_changes : rtypes.bool
        is_saving               : rtypes.bool
        is_full                 : rtypes.bool
        is_only                 : rtypes.bool    # is the only frame
        is_public               : rtypes.bool    # public view of a file
        type                    : rtypes.string.isRequired
        editor_spec             : rtypes.object  # describes editor options; assumed to never change

    shouldComponentUpdate: (next) ->
        return misc.is_different(@props, next, ['active_id', 'id', 'deletable', 'is_full', 'is_only', \
                     'read_only', 'has_unsaved_changes', 'has_uncommitted_changes', 'is_public', 'is_saving', 'type'])

    componentWillReceiveProps: ->
        @_last_render = new Date()

    is_visible: (action_name, explicit) ->
        buttons = @props.editor_spec?[@props.type]?.buttons
        if not explicit and not buttons?
            return true
        return buttons?[action_name]

    click_close: ->
        if new Date() - @_last_render < 200
            # avoid accidental click -- easily can happen otherwise.
            return
        @props.actions.close_frame(@props.id)

    button_size: ->
        if @props.is_only or @props.is_full
            return
        else
            return 'small'

    render_x: ->
        show_full = @props.is_full or @props.active_id == @props.id
        <Button
            title   = {'Close this frame'}
            style   = {if not show_full then close_style}
            key     = {'close'}
            bsSize  = {@button_size()}
            onClick = {@click_close}
        >
            <Icon name={'times'}/>
        </Button>

    select_type: (type) ->
        @props.actions.set_frame_type?(@props.id, type)

    render_types: ->
        if not @props.editor_spec?
            return

        selected_type  = @props.type
        selected_icon  = ''
        selected_short = ''
        items = []
        for type, spec of @props.editor_spec
            if selected_type == type
                selected_icon  = spec.icon
                selected_short = spec.short
            item = <MenuItem
                        selected = {selected_type == type}
                        key      = {type}
                        eventKey = {type}
                        onSelect = {@select_type}
                    >
                    <Icon name={spec.icon} style={ICON_STYLE} /> {spec.name}
                </MenuItem>
            items.push(item)

        title = <Icon name={selected_icon} />
        if selected_short
            title = <span>{title} {selected_short}</span>
        <DropdownButton
          title     = {title}
          key       = {'types'}
          id        = {'types'}
          bsSize    = {@button_size()}
        >
            {items}
        </DropdownButton>

    render_control: ->
        is_active = @props.active_id == @props.id
        <ButtonGroup style={float:'right'} key={'close'}>
            {@render_types()     if is_active}
            {@render_split_row() if is_active and not @props.is_full}
            {@render_split_col() if is_active and not @props.is_full}
            {@render_full()      if is_active and not @props.is_only}
            {@render_x()}
        </ButtonGroup>

    render_full: ->
        if @props.is_full
            <Button
                disabled = {@props.is_only}
                title    = {'Show all frames'}
                key      = {'compress'}
                bsSize   = {@button_size()}
                onClick  = {=> @props.actions.set_frame_full()}
            >
                <Icon name={'compress'}/>
            </Button>
        else
            <Button
                disabled = {@props.is_only}
                key      = {'expand'}
                title    = {'Show only this frame'}
                bsSize   = {@button_size()}
                onClick  = {=> @props.actions.set_frame_full(@props.id)}
            >
                <Icon name={'expand'}/>
            </Button>

    render_split_row: ->
        <Button
            key     = {'split-row'}
            title   = {'Split frame horizontally into two rows'}
            bsSize  = {@button_size()}
            onClick = {(e)=>e.stopPropagation(); if @props.is_full then @props.actions.set_frame_full() else @props.actions.split_frame('row', @props.id)}
        >
            <Icon name='columns' rotate={'90'} />
        </Button>

    render_split_col: ->
        <Button
            key     = {'split-col'}
            title   = {'Split frame vertically into two columns'}
            bsSize  = {@button_size()}
            onClick = {(e)=>e.stopPropagation(); if @props.is_full then @props.actions.set_frame_full() else @props.actions.split_frame('col', @props.id)}
        >
            <Icon name='columns' />
        </Button>

    render_zoom_out: ->
        if not @is_visible('decrease_font_size')
            return
        <Button
            key     = {'font-increase'}
            title   = {'Decrease font size'}
            bsSize  = {@button_size()}
            onClick = {=>@props.actions.decrease_font_size(@props.id)}
        >
            <Icon name={'search-minus'} />
        </Button>

    render_zoom_in: ->
        if not @is_visible('increase_font_size')
            return
        <Button
            key     = {'font-decrease'}
            title   = {'Increase font size'}
            onClick = {=>@props.actions.increase_font_size(@props.id)}
            bsSize  = {@button_size()}
        >
            <Icon name={'search-plus'} />
        </Button>

    render_zoom_page_width: ->
        <Button
            key     = {'text-width'}
            title   = {'Zoom to page width'}
            bsSize  = {@button_size()}
            onClick = {=>@props.actions.zoom_page_width(@props.id)}
        >
            <Icon name={'arrows-alt-h'} />
        </Button>

    render_zoom_page_height: ->
        <Button
            key     = {'text-height'}
            title   = {'Zoom to page height'}
            bsSize  = {@button_size()}
            onClick = {=>@props.actions.zoom_page_height(@props.id)}
        >
            <Icon name={'arrows-alt-v'} />
        </Button>

    render_sync: ->
        if not @is_visible('sync') or not @props.actions.sync?
            return
        labels   = @show_labels()
        <Fragment>
            <Space />
            <Button
                key     = {'sync'}
                title   = {'Synchronize views (alt+enter)'}
                bsSize  = {@button_size()}
                onClick = {=>@props.actions.sync(@props.id)}
            >
                <Icon name={'fab fa-staylinked'} /> {if labels then <VisibleMDLG>Sync</VisibleMDLG>}
            </Button>
        </Fragment>

    render_replace: ->
        if not @is_visible('replace')
            return
        <Button
            key      = {'replace'}
            title    = {'Replace text'}
            onClick  = {=>@props.actions.replace(@props.id)}
            disabled = {@props.read_only}
            bsSize   = {@button_size()}
        >
            <Icon name='exchange' />
        </Button>

    render_find: ->
        if not @is_visible('find')
            return
        <Button
            key     = {'find'}
            title   = {'Find text'}
            onClick = {=>@props.actions.find(@props.id)}
            bsSize  = {@button_size()}
        >
            <Icon name='search' />
        </Button>

    render_goto_line: ->
        if not @is_visible('goto_line')
            return
        <Button
            key     = {'goto-line'}
            title   = {'Jump to line'}
            onClick = {=>@props.actions.goto_line(@props.id)}
            bsSize  = {@button_size()}
        >
            <Icon name='bolt' />
        </Button>

    render_find_replace_group: ->
        <Fragment>
            <Space />
            <ButtonGroup key={'find-group'}>
                {@render_find()}
                {@render_replace() if not @props.is_public}
                {@render_goto_line()}
            </ButtonGroup>
        </Fragment>

    render_cut: ->
        if not @is_visible('cut')
            return
        <Button
            key      = {'cut'}
            title    = {'Cut selected text'}
            onClick  = {=>@props.actions.cut(@props.id)}
            disabled = {@props.read_only}
            bsSize   = {@button_size()}
        >
            <Icon name={'scissors'} />
        </Button>

    render_paste: ->
        if not @is_visible('paste')
            return
        <Button
            key      = {'paste'}
            title    = {'Paste buffer'}
            onClick  = {debounce((=>@props.actions.paste(@props.id)), 200, true)}
            disabled = {@props.read_only}
            bsSize   = {@button_size()}
        >
            <Icon name={'paste'} />
        </Button>

    render_copy: ->
        if not @is_visible('copy')
            return
        <Button
            key     = {'copy'}
            title   = {'Copy selected text'}
            onClick = {=>@props.actions.copy(@props.id)}
            bsSize  = {@button_size()}
        >
            <Icon name={'copy'} />
        </Button>

    render_copy_group: ->
        <Fragment>
            <Space />
            <ButtonGroup key={'copy'}>
                {@render_cut() if not @props.is_public}
                {@render_copy()}
                {@render_paste() if not @props.is_public}
            </ButtonGroup>
        </Fragment>

    render_zoom_group: ->
        if not @is_visible('decrease_font_size')
            return
        <Fragment>
            <Space />
            <ButtonGroup key={'zoom'}>
                {@render_zoom_out()}
                {@render_zoom_in()}
            </ButtonGroup>
        </Fragment>

    render_page_width_height_group: ->
        if not @is_visible('zoom_page_width') or not @props.actions.zoom_page_width?
            return
        <Fragment>
            <Space />
            <ButtonGroup key={'height-width'}>
                {@render_zoom_page_height()}
                {@render_zoom_page_width()}
            </ButtonGroup>
        </Fragment>

    render_split_group: ->
        <ButtonGroup  key={'split'}>
            {@render_split_row()}
            {@render_split_col()}
        </ButtonGroup>

    render_undo: ->
        if not @is_visible('undo')
            return
        <Button
            key      = {'undo'}
            title    = {'Undo last thing you did'}
            onClick  = {@props.actions.undo}
            disabled = {@props.read_only}
            bsSize   = {@button_size()}
        >
            <Icon name='undo' />
        </Button>

    render_redo: ->
        if not @is_visible('redo')
            return
        <Button
            key      = {'redo'}
            title    = {'Redo last thing you did'}
            onClick  = {@props.actions.redo}
            disabled = {@props.read_only}
            bsSize   = {@button_size()}
        >
            <Icon name='repeat' />
        </Button>

    render_undo_redo_group: ->
        <Fragment>
            <Space />
            <ButtonGroup key={'undo-group'}>
                {@render_undo()}
                {@render_redo()}
            </ButtonGroup>
        </Fragment>

    render_format_group: ->
        if not @is_visible('auto_indent')
            return
        <Fragment>
            <Space />
            <ButtonGroup key={'format-group'}>
                <Button
                    key      = {'auto-indent'}
                    title    = {'Automatically format selected code'}
                    onClick  = {@props.actions.auto_indent}
                    disabled = {@props.read_only}
                    bsSize   = {@button_size()}
                >
                    <Icon name='indent' />
                </Button>
            </ButtonGroup>
        </Fragment>

    show_labels: ->
        return @props.is_only or @props.is_full

    render_timetravel: (labels) ->
        if not @is_visible('time_travel')
            return
        <Button
            key     = {'timetravel'}
            title   = {'Show complete edit history'}
            bsStyle = {'info'}
            bsSize  = {@button_size()}
            onClick = {@props.actions.time_travel}
        >
            <Icon name='history' /> <VisibleMDLG>{if labels then 'TimeTravel'}</VisibleMDLG>
        </Button>

    # Button to reload the document
    render_reload: (labels) ->
        if not @is_visible('reload', true)
            return
        <Button
            key     = {'reload'}
            title   = {'Reload this file'}
            bsSize  = {@button_size()}
            onClick = {@props.actions.reload}
        >
            <Icon name='repeat' /> <VisibleMDLG>{if labels then 'Reload'}</VisibleMDLG>
        </Button>

    # A "Help" info button
    render_help: (labels) ->
        if not @is_visible('help', true) or @props.is_public
            return
        labels = @show_labels()
        <Fragment>
            <Space/>
            <Button
                key     = {'help'}
                title   = {'Show help for working with this type of document'}
                bsSize  = {@button_size()}
                onClick = {=>@props.actions.help?(@props.type)}
            >
                <Icon name='question-circle' /> <VisibleMDLG>{if labels then 'Help'}</VisibleMDLG>
            </Button>
        </Fragment>

    render_save: (labels) ->
        if not @is_visible('save')
            return
        disabled = not @props.has_unsaved_changes or @props.read_only or @props.is_public
        if labels
            if @props.is_public
                label = 'Public'
            else if @props.read_only
                label = 'Readonly'
            else
                label = 'Save'
        else
            label = ''
        if @props.is_saving
            icon = 'arrow-circle-o-left'
        else
            icon = 'save'

        # The funny style in the icon below is because the width changes slightly depending
        # on which icon we are showing.
        <Button
            key      = {'save'}
            title    = {"Save file to disk"}
            bsStyle  = {'success'}
            bsSize   = {@button_size()}
            disabled = {disabled}
            onClick  = {=>@props.actions.save(true)}
        >
            <Icon name={icon} style={width:'15px', display:'inline-block'}/> <VisibleMDLG>{label}</VisibleMDLG>
            <UncommittedChanges has_uncommitted_changes={@props.has_uncommitted_changes} />
        </Button>

    render_save_timetravel_group: ->
        labels   = @show_labels()
        <ButtonGroup key={'save-group'}>
            {@render_save(labels)}
            {@render_timetravel(labels) if not @props.is_public}
            {@render_reload(labels)}
        </ButtonGroup>

    render_format: ->
        if not @is_visible('format') or not util.PRETTIER_SUPPORT[misc.filename_extension(@props.path)]
            return
        <Fragment>
            <Space/>
            <Button
                bsSize  = {@button_size()}
                key     = {'format'}
                onClick = {=>@props.actions.format(@props.id)}
                title   = {'Run Prettier (or some other AST-based service) to canonically format this entire document'}
            >
                <Icon name={'fa-sitemap'} /> <VisibleMDLG>{if @show_labels() then 'Format'}</VisibleMDLG>
            </Button>
        </Fragment>

    render_print: ->
        if not @is_visible('print')
            return
        <Fragment>
            <Space />
            <Button
                bsSize  = {@button_size()}
                key     = {'print'}
                onClick = {=>@props.actions.print(@props.id)}
                title   = {'Print file to PDF'}
            >
                <Icon name={'print'} /> <VisibleMDLG>{if @show_labels() then 'Print'}</VisibleMDLG>
            </Button>
        </Fragment>

    render_file_menu: ->
        if not (@props.is_only or @props.is_full)
            return
        <EditorFileInfoDropdown
            key       = {'info'}
            title     = {'File related actions'}
            filename  = {@props.path}
            actions   = {redux.getProjectActions(@props.project_id)}
            is_public = {false}
            label     = {'File'}
            bsSize    = {@button_size()}
        />

    render_buttons: ->
        if not (@props.is_only or @props.is_full)
            # When in split view, we let the buttonbar flow around and hide, so that
            # extra buttons are cleanly not visible when frame is thin.
            style = {maxHeight:'30px', overflow:'hidden', flex:1}
        else
            style = {maxHeight:'34px', overflow:'hidden', flex:1}
        <div
            style = {style}
            key   = {'buttons'}>
            {@render_save_timetravel_group()}
            {@render_undo_redo_group() if not @props.is_public}
            {@render_zoom_group()}
            {@render_sync()}
            {@render_page_width_height_group()}
            {@render_copy_group()}
            {@render_find_replace_group()}
            {@render_format_group() if not @props.is_public}
            {@render_format()}
            {<Space/>}
            {@render_print()}
            {@render_help()}
        </div>

    render_path: ->
        <span style={path_style}>
            <Tip
                placement = {'bottom'}
                title     = {@props.path}
            >
                {misc.path_split(@props.path).tail}
            </Tip>
        </span>

    render_main_buttons: ->
        # This is complicated below (with the flex display) in order to have a drop down menu that actually appears
        # and *ALSO* have buttons that vanish when there are many of them (via scrolling around).
        <div style={display:'flex'}>
            {@render_file_menu() if not @props.is_public}
            {@render_buttons()}
        </div>

    render_title: ->
        spec = @props.editor_spec?[@props.type]
        if not spec?
            return
        <span style={TITLE_STYLE}>
            <Icon name={spec.icon} />
            <Space />
            {spec.title ? spec.name ? spec.short ? ''}
        </span>

    render: ->
        # Whether this is *the* active currently focused frame:
        is_active = @props.id == @props.active_id
        if is_active
            style = misc.copy(title_bar_style)
            style.background = '#f8f8f8'
        else
            style = title_bar_style

        if $?.browser?.safari  # ugly hack....
            # for some reason this is really necessary on safari, but
            # breaks on everything else!
            if not is_active
                style = misc.copy(style)
            if @props.is_only or @props.is_full
                style.minHeight = '36px'
            else
                style.minHeight = '32px'

        <div style = {style}>
            {@render_control()}
            {if is_active then @render_main_buttons()}
            {if not is_active then @render_title()}
        </div>