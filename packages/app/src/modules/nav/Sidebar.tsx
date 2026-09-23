import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import StorageIcon from '@material-ui/icons/Storage';
import BusinessIcon from '@material-ui/icons/Business';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import {
  useTenant,
  TenantSwitcher,
} from '@internal/backstage-plugin-multitenant';

const useSwitcherStyles = makeStyles(theme => ({
  wrapper: {
    padding: theme.spacing(1, 1),
    display: 'flex',
    justifyContent: 'center',
  },
}));

function SidebarTenantSwitcher() {
  const classes = useSwitcherStyles();
  return (
    <Box className={classes.wrapper}>
      <TenantSwitcher />
    </Box>
  );
}

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const { navConfig } = useTenant();

      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items — handled manually for ordering / conditionality
      nav.take('page:search');        // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually
      nav.take('page:gitlab');        // Placed manually below for better ordering

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarTenantSwitcher />
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:home')}
            {nav.take('page:catalog')}

            {/* Create / Scaffolder — hidden for company-b */}
            {navConfig.showScaffolder && nav.take('page:scaffolder')}

            {/* Infrastructure — hidden for company-b */}
            {navConfig.showInfrastructure && (
              <SidebarItem
                icon={StorageIcon}
                to="infrastructure"
                text="Infrastructure"
              />
            )}

            {/* My Projects (multitenant) — shown to all tenants */}
            {navConfig.showMyProjects && (
              <SidebarItem
                icon={BusinessIcon}
                to="multitenant"
                text="My Projects"
              />
            )}

            <SidebarDivider />
            <SidebarScrollWrapper>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>

          <SidebarSpace />
          <SidebarDivider />


          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Settings"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
