
###############################################################################
#
#    CoCalc: Collaborative Calculation in the Cloud
#
#    Copyright (C) 2016, Sagemath Inc.
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


############################################################
# Account Settings
############################################################

{webapp_client} = require('./webapp_client')
{alert_message} = require('./alerts')
account_page    = require('./account_page')
misc_page = require('./misc_page')

misc     = require("misc")
{redux}   = require('./app-framework')

{reset_password_key} = require('./password-reset')

################################################
# Account creation
################################################

first_login = true

# load more of the app now that user is logged in.
load_app = (cb) ->
    require.ensure [], ->
        require('./r_account.cjsx')  # initialize react-related account page
        require('./projects.cjsx')   # initialize project listing
        cb()

webapp_client.on 'mesg_info', (info) ->
    f = -> redux.getActions('account')?.setState(mesg_info: info)
    # must be scheduled separately, since this notification can be triggered during rendering
    setTimeout(f, 1)

signed_in = (mesg) ->
    # the has_remember_me cookie is for usability: After a sign in we "mark" this client as being "known"
    # next time the main landing page is visited, haproxy or hub will redirect to the client
    # note: similar code is in redux_account.coffee → AccountActions::sign_out
    {APP_BASE_URL} = require('./misc_page')
    exp = misc.server_days_ago(-30).toGMTString()
    document.cookie = "#{APP_BASE_URL}has_remember_me=true; expires=#{exp} ;path=/"
    # Record which hub we're connected to.
    redux.getActions('account').setState(hub: mesg.hub)
    require('./file-use/init')   # initialize file_use notifications
    console.log("Signed into #{mesg.hub} at #{new Date()}")
    if first_login
        first_login = false
        {analytics_event} = require('./misc_page')
        analytics_event('account', 'signed_in')    # user signed in
        if not misc_page.should_load_target_url()
            load_app ->
                require('./history').load_target('projects')
    # loading a possible target is done after restoring a session -- see session.coffee


# Listen for pushed sign_in events from the server.  This is one way that
# the sign_in function above can be activated, but not the only way.
webapp_client.on("signed_in", signed_in)

################################################
# Automatically log in
################################################
remember_me = webapp_client.remember_me_key()
if reset_password_key()
    # Attempting to do a password reset -- clearly we do NOT want to wait in the hopes
    # that sign in via a cookie is going to work.  Without deleting this, the reset
    # password dialog that appears will immediately vanish with a frustrating redirect.
    delete localStorage[remember_me]

if misc.get_local_storage(remember_me)
    redux.getActions('account').setState(remember_me: true)
    # just in case, always show manual login screen after 45s.
    setTimeout (->
        redux.getActions('account').setState(remember_me: false)
    ), 45000
webapp_client.on "remember_me_failed", () ->
    redux.getActions('account').setState(remember_me: false)
    if redux.getStore('account')?.get('is_logged_in')  # if we thought user was logged in, but the cookie was invalid, force them to sign in again
        f = ->
            if not misc.get_local_storage(remember_me)
                alert_message(type:'info', message:'You might have to sign in again.', timeout:1000000)
        setTimeout(f, 15000)  # give it time to possibly resolve itself.  SMELL: confused about what is going on here...

# Check if user has a has_remember_me cookie (regardless if it is valid or not)
# the real "remember_me" is set to be http-only and hence not accessible from javascript (security).
{get_cookie, APP_BASE_URL} = require('./misc_page')
redux.getActions('account').setState(has_remember_me : get_cookie("#{APP_BASE_URL}has_remember_me") == 'true')

# Return a default filename with the given ext (or not extension if ext not given)
# this is just a wrapper for backwards compatibility
{NewFilenames} = require('project/utils')
{NEW_FILENAMES} = require('smc-util/db-schema')
new_filenames_generator = new NewFilenames(undefined, true)
exports.default_filename = (ext, project_id) ->
    type = redux.getStore("account")?.getIn(["other_settings", NEW_FILENAMES]) ? NewFilenames.default_family
    new_filenames_generator.set_ext(ext)
    if project_id?
        avoid = redux.getProjectActions(project_id).get_filenames_in_current_dir()
        return new_filenames_generator.gen(type, avoid)
    else
        return new_filenames_generator.gen(type)

