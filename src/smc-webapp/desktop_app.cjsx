##############################################################################
#
#    CoCalc: Collaborative Calculation in the Cloud
#
#    Copyright (C) 2016 -- 2017, Sagemath Inc.
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
###############################################################################

{isMobile} = require('./feature')

{React, ReactDOM, rclass, redux, rtypes, Redux} = require('./smc-react')

{Navbar, Nav, NavItem} = require('react-bootstrap')
{Loading, Icon, Tip}   = require('./r_misc')
{COLORS} = require('smc-util/theme')

# CoCalc Pages
# SMELL: Page UI's are mixed with their store/state.
# So we have to require them even though they aren't used
{HelpPage}     = require('./r_help')
{ProjectsPage} = require('./projects')
{ProjectPage}  = require('./project_page')
{AccountPage}  = require('./account_page') # SMELL: Not used but gets around a webpack error..
{FileUsePage}  = require('./file_use')
{Support}      = require('./support')
{Avatar}       = require('./other-users')

# CoCalc Libraries
misc = require('smc-util/misc')

{ProjectsNav} = require('./projects_nav')
{ActiveAppContent, CookieWarning, GlobalInformationMessage, LocalStorageWarning, ConnectionIndicator, ConnectionInfo, FullscreenButton, NavTab, NotificationBell, AppLogo, VersionWarning} = require('./app_shared')

nav_class = 'hidden-xs'

FileUsePageWrapper = (props) ->
    styles =
        zIndex       : '10'
        marginLeft   : '0'
        position     : 'fixed'
        boxShadow    : '0 0 15px #aaa'
        border       : '2px solid #ccc'
        top          : '43px'
        background   : '#fff'
        right        : '2em'
        overflowY    : 'auto'
        overflowX    : 'hidden'
        fontSize     : '10pt'
        padding      : '4px'
        borderRadius : '5px'
        width        : '50%'
        height       : '90%'

    <div style={styles}>
        {<FileUsePage redux={redux} />}
    </div>

# TODO: important to nail down the data below as immutable and add shouldComponentUpdate, since
# this Page component gets massive not-needed rendering all the time!!!!
Page = rclass
    displayName : "Page"

    reduxProps :
        projects :
            open_projects     : rtypes.immutable.List
        page :
            active_top_tab    : rtypes.string    # key of the active tab
            show_connection   : rtypes.bool
            ping              : rtypes.number
            avgping           : rtypes.number
            connection_status : rtypes.string
            new_version       : rtypes.object
            fullscreen        : rtypes.oneOf(['default', 'kiosk'])
            cookie_warning    : rtypes.bool
            local_storage_warning : rtypes.bool
            show_file_use     : rtypes.bool
        file_use :
            file_use         : rtypes.immutable.Map
            get_notify_count : rtypes.func
        account :
            account_id   : rtypes.string
            first_name   : rtypes.string # Necessary for get_fullname
            last_name    : rtypes.string # Necessary for get_fullname
            get_fullname : rtypes.func
            user_type    : rtypes.string # Necessary for is_logged_in
            is_logged_in : rtypes.func
            other_settings : rtypes.object
            is_global_info_visible : rtypes.func
        support :
            show : rtypes.bool

    propTypes :
        redux : rtypes.object

    componentWillUnmount: ->
        @actions('page').clear_all_handlers()

    account_name: ->
        name = ''
        if @props.get_fullname?
            name = misc.trunc_middle(@props.get_fullname(), 32)
        if not name.trim()
            name = "Account"
        return name

    render_account_tab: ->
        if false and @props.account_id
            a = <Avatar
                    size       = {20}
                    account_id = {@props.account_id}
                    no_tooltip = {true}
                    no_loading = {true}
                    />
        else
            a = 'cog'

        <NavTab
            name           = 'account'
            label          = {'Account'}
            label_class    = {nav_class}
            icon           = {a}
            actions        = {@actions('page')}
            active_top_tab = {@props.active_top_tab}
        />

    sign_in_tab_clicked: ->
        if @props.active_top_tab == 'account'
            @actions('page').sign_in()

    render_sign_in_tab: ->
        <NavTab
            name            = 'account'
            label           = 'Sign in'
            label_class     = {nav_class}
            icon            = 'sign-in'
            on_click        = {@sign_in_tab_clicked}
            actions         = {@actions('page')}
            active_top_tab  = {@props.active_top_tab}
            style           = {backgroundColor:COLORS.TOP_BAR.SIGN_IN_BG}
            add_inner_style = {color: 'black'}
        />

    render_support: ->
        if not require('./customize').commercial
            return
        <NavTab
            label          = {'Help'}
            label_class    = {nav_class}
            icon           = {'medkit'}
            actions        = {@actions('page')}
            active_top_tab = {@props.active_top_tab}
            on_click       = {=>redux.getActions('support').show(true)}
        />

    render_bell: ->
        if not @props.is_logged_in()
            return
        <NotificationBell
            count  = {@props.get_notify_count()}
            active = {@props.show_file_use} />

    render_right_nav: ->
        logged_in = @props.is_logged_in()
        <Nav id='smc-right-tabs-fixed' style={height:'40px', lineHeight:'20px', margin:'0', overflowY:'hidden'}>
            {@render_account_tab() if logged_in}
            {@render_sign_in_tab() if not logged_in}
            <NavTab
                name           = {'about'}
                label          = {'CoCalc'}
                label_class    = {nav_class}
                icon           = {'info-circle'}
                actions        = {@actions('page')}
                active_top_tab = {@props.active_top_tab} />
            <NavItem className='divider-vertical hidden-xs' />
            {@render_support()}
            {@render_bell()}
            <ConnectionIndicator actions={@actions('page')} />
        </Nav>

    render_project_nav_button: ->
        projects_styles =
            whiteSpace : 'nowrap'
            float      : 'right'
            padding    : '11px 7px'
            fontWeight : 'bold'

        <Nav style={height:'40px', margin:'0', overflow:'hidden'}>
            <NavTab
                name           = {'projects'}
                inner_style    = {padding:'0px'}
                actions        = {@actions('page')}
                active_top_tab = {@props.active_top_tab}

            >
                <div style={projects_styles} className={nav_class}>
                    Projects
                </div>
                <AppLogo />
            </NavTab>
        </Nav>

    # register a default drag and drop handler, that prevents accidental file drops
    # TEST: make sure that usual drag'n'drop activities like rearranging tabs and reordering tasks work
    drop: (e) ->
        if DEBUG
            e.persist()
            console.log "react desktop_app.drop", e
        e.preventDefault()
        e.stopPropagation()
        if e.dataTransfer.files.length > 0
            {alert_message} = require('./alerts')
            alert_message
                type     : 'info'
                title    : 'File Drop Rejected'
                message  : 'To upload a file, drop it onto the files listing or the "Drop files to upload" area in the +New tab.'

    render: ->
        style =
            display       : 'flex'
            flexDirection : 'column'
            height        : '100vh'
            width         : '100vw'
            overflow      : 'hidden'

        show_global_info = @props.is_global_info_visible() and (not @props.fullscreen) and @props.is_logged_in()

        style_top_bar =
            display       : 'flex'
            marginBottom  : 0
            width         : '100%'
            minHeight     : '40px'
            position      : 'fixed'
            right         : 0
            zIndex        : '100'
            borderRadius  : 0
            top           : if show_global_info then '40px' else 0

        positionHackHeight = (40 + if show_global_info then 40 else 0) + 'px'

        <div ref="page" style={style} onDragOver={(e) -> e.preventDefault()} onDrop={@drop}>
            {<FileUsePageWrapper /> if @props.show_file_use}
            {<ConnectionInfo ping={@props.ping} status={@props.connection_status} avgping={@props.avgping} actions={@actions('page')} /> if @props.show_connection}
            {<Support actions={@actions('support')} /> if @props.show}
            {<VersionWarning new_version={@props.new_version} /> if @props.new_version?}
            {<CookieWarning /> if @props.cookie_warning}
            {<LocalStorageWarning /> if @props.local_storage_warning}
            {<GlobalInformationMessage /> if show_global_info}
            {<Navbar className="smc-top-bar" style={style_top_bar}>
                {@render_project_nav_button() if @props.is_logged_in()}
                <ProjectsNav dropdown={false} />
                {@render_right_nav()}
            </Navbar> if not @props.fullscreen}
            {<div className="smc-sticky-position-hack" style={minHeight:positionHackHeight}> </div>if not @props.fullscreen}
            {<FullscreenButton /> if (@props.fullscreen != 'kiosk')}
            {### Children must define their own padding from navbar and screen borders ###}
            {### Note that the parent is a flex container ###}
            <ActiveAppContent active_top_tab={@props.active_top_tab}/>
        </div>

page = <Redux redux={redux}>
    <Page redux={redux}/>
</Redux>

exports.render = () => ReactDOM.render(page, document.getElementById('smc-react-container'))