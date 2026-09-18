import React, { useState, useCallback } from 'react';
import { useAsync } from 'react-use';
import {
  Content,
  ContentHeader,
  Header,
  HeaderLabel,
  Page,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  configApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import {
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import DeleteIcon from '@material-ui/icons/Delete';
import LockIcon from '@material-ui/icons/Lock';
import { DeleteDialog } from './DeleteDialog';
import { TokenManagementTab } from './TokenManagementTab';
import { createPhWorkflowsClient } from '../../api/client';
import { WorkflowSummary } from '../../api/types';
import { useUserGroups } from '../../hooks/useUserGroups';

const useStyles = makeStyles(theme => ({
  deleteButton: {
    color: theme.palette.error.main,
  },
}));

interface ComponentRow {
  entity: Entity | null;
  name: string;
  description: string;
  owner: string;
  repoUrl: string;
  jiraUrl: string;
  jiraLabel: string;
  contentType: string;
  deploymentMode: string;
  createdAt: string;
  workflowState: string;
}

function toRow(wf: WorkflowSummary, entityMap: Record<string, Entity>): ComponentRow {
  const entity = entityMap[wf.projectId] || null;
  const annotations = entity?.metadata?.annotations ?? {};
  const slug = annotations['github.com/project-slug'] ?? '';
  const repoUrl = wf.repoUrl || (slug ? `https://github.com/${slug}` : '');

  const owner = wf.owner || annotations['ph.rhdp.io/owner'] || '';

  const links = entity ? ((entity.metadata as any)?.links ?? []) : [];
  const jiraLink = links.find((l: any) => l.title === 'Jira Epic' || (l.url && l.url.includes('atlassian.net/browse/')));
  const jiraUrl = jiraLink?.url || wf?.jiraUrl || '';
  const jiraLabel = jiraUrl ? (jiraUrl.split('/').pop() ?? 'Epic') : '';

  const rawTs = wf.startedAt || annotations['ph.rhdp.io/created-at'] || '';
  let createdAt = '';
  if (rawTs) {
    try { createdAt = new Date(rawTs).toLocaleDateString(); } catch { createdAt = rawTs; }
  }

  return {
    entity,
    name: wf.projectId,
    description: wf.projectDescription || entity?.metadata?.description || '',
    owner,
    repoUrl,
    jiraUrl,
    jiraLabel,
    contentType: wf.contentType || annotations['ph.rhdp.io/content-type'] || '',
    deploymentMode: wf.deploymentMode || '',
    createdAt,
    workflowState: wf?.state ?? '',
  };
}

export function MaintenancePage() {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const configApi = useApi(configApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const identityApi = useApi(identityApiRef);
  const centralApiUrl = configApi.getString('phWorkflows.centralApiUrl');
  const { isAdmin, loading: groupsLoading } = useUserGroups();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ projectId: string; entity: Entity | null; repoUrl: string } | null>(null);

  const client = createPhWorkflowsClient({ centralApiUrl, discoveryApi, fetchApi, identityApi });

  const { value, loading, error } = useAsync(async () => {
    const [workflows, catalogResult] = await Promise.all([
      client.getWorkflows(),
      catalogApi.getEntities({
        filter: { kind: 'Component', 'metadata.tags': 'publishing-house' },
        fields: [
          'metadata.name',
          'metadata.description',
          'metadata.uid',
          'metadata.annotations',
          'metadata.links',
          'metadata.tags',
          'kind',
        ],
      }),
    ]);

    // Build map of catalog entities by project ID
    const entityMap: Record<string, Entity> = {};
    for (const entity of catalogResult.items) {
      const name = entity.metadata?.name;
      if (name) {
        entityMap[name] = entity;
      }
    }

    return { workflows, entityMap };
  }, [refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const workflows = value?.workflows ?? [];
  const entityMap = value?.entityMap ?? {};
  const rows = workflows.map(wf => toRow(wf, entityMap));

  const columns: TableColumn<ComponentRow>[] = [
    {
      title: 'Name',
      field: 'name',
      highlight: true,
    },
    {
      title: 'Owner',
      field: 'owner',
      render: (row: ComponentRow) => row.owner || '—',
    },
    {
      title: 'Description',
      field: 'description',
      render: (row: ComponentRow) =>
        row.description.length > 80
          ? `${row.description.slice(0, 80)}...`
          : row.description || '—',
    },
    {
      title: 'Type',
      field: 'contentType',
    },
    {
      title: 'Mode',
      field: 'deploymentMode',
      render: (row: ComponentRow) => {
        const mode = row.deploymentMode;
        if (mode === 'rhdp-published') return 'RHDP Published';
        if (mode === 'self-published') return 'Self Published';
        if (mode === 'express') return 'Express';
        return mode || '—';
      },
    },
    {
      title: 'Created',
      field: 'createdAt',
      render: (row: ComponentRow) => row.createdAt || '—',
    },
    {
      title: 'Repo',
      field: 'repoUrl',
      render: (row: ComponentRow) =>
        row.repoUrl ? (
          <a href={row.repoUrl} target="_blank" rel="noopener noreferrer">
            {row.repoUrl}
          </a>
        ) : (
          '—'
        ),
    },
    {
      title: 'Jira',
      field: 'jiraLabel',
      render: (row: ComponentRow) =>
        row.jiraUrl ? (
          <a href={row.jiraUrl} target="_blank" rel="noopener noreferrer">
            {row.jiraLabel}
          </a>
        ) : (
          '—'
        ),
    },
    {
      title: 'Actions',
      field: 'name',
      sorting: false,
      render: (row: ComponentRow) =>
        row.workflowState === 'COMPLETED' ? (
          <Typography variant="caption" color="textSecondary">Completed</Typography>
        ) : (
          <Tooltip title="Delete component and resources">
            <IconButton
              size="small"
              className={classes.deleteButton}
              onClick={e => {
                e.stopPropagation();
                setDeleteTarget({ projectId: row.name, entity: row.entity, repoUrl: row.repoUrl });
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
    },
  ];

  if (!groupsLoading && !isAdmin) {
    return (
      <Page themeId="tool">
        <Header title="Publishing House" subtitle="Component maintenance and cleanup" />
        <Content>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 64, gap: 16 }}>
            <LockIcon style={{ fontSize: 48, color: '#757575' }} />
            <Typography variant="h6" color="textSecondary">Access Restricted</Typography>
            <Typography variant="body2" color="textSecondary">
              This page is only available to members of rhdp-administrators.
            </Typography>
          </div>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Publishing House" subtitle="Maintenance and administration">
        <HeaderLabel label="Projects" value={String(workflows.length)} />
      </Header>
      <Content>
        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          style={{ marginBottom: 16 }}
        >
          <Tab label="Components" />
          <Tab label="Token Management" />
        </Tabs>

        {activeTab === 0 && (
          <>
            <ContentHeader title="Registered Components">
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </ContentHeader>
            <Table<ComponentRow>
              title="Publishing House Components"
              options={{
                search: true,
                paging: true,
                pageSize: 20,
                padding: 'dense',
              }}
              columns={columns}
              data={rows}
              isLoading={loading}
              emptyContent={
                error ? (
                  <div style={{ padding: 16 }}>
                    Failed to load components: {error.message}
                  </div>
                ) : undefined
              }
            />
            <DeleteDialog
              open={!!deleteTarget}
              projectId={deleteTarget?.projectId || ''}
              entity={deleteTarget?.entity || null}
              repoUrl={deleteTarget?.repoUrl}
              onClose={() => setDeleteTarget(null)}
              onDeleted={() => {
                setDeleteTarget(null);
                handleRefresh();
              }}
            />
          </>
        )}

        {activeTab === 1 && <TokenManagementTab />}
      </Content>
    </Page>
  );
}
