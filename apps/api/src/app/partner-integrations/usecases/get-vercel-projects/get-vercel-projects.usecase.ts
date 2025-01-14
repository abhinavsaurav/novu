import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { OrganizationRepository } from '@novu/dal';
import { ApiException } from '../../../shared/exceptions/api.exception';
import { GetVercelProjectsCommand } from './get-vercel-projects.command';

interface IGetVercelConfiguration {
  userId: string;
  configurationId: string;
}

@Injectable()
export class GetVercelProjects {
  constructor(private httpService: HttpService, private organizationRepository: OrganizationRepository) {}

  async execute(command: GetVercelProjectsCommand) {
    const configuration = await this.getVercelConfiguration({
      configurationId: command.configurationId,
      userId: command.userId,
    });

    if (!configuration.accessToken) {
      throw new ApiException();
    }

    const projects = await this.getVercelProjects(configuration.accessToken, configuration.teamId, command.nextPage);

    return projects;
  }

  async getVercelConfiguration(payload: IGetVercelConfiguration) {
    const organization = await this.organizationRepository.findPartnerConfigurationDetails(
      payload.userId,
      payload.configurationId
    );

    return {
      accessToken: organization[0].partnerConfigurations[0].accessToken,
      teamId: organization[0].partnerConfigurations[0].teamId,
    };
  }

  private async getVercelProjects(accessToken: string, teamId: string | null, until?: string) {
    let queryParams = '';

    if (teamId) {
      queryParams += `teamId=${teamId}&`;
    }

    if (until) {
      queryParams += `until=${until}`;
    }

    const response = await lastValueFrom(
      this.httpService.get(`${process.env.VERCEL_BASE_URL}/v4/projects${queryParams ? `?${queryParams}` : ''}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    );

    return { projects: this.mapProjects(response.data.projects), pagination: response.data.pagination };
  }

  private mapProjects(projects) {
    return projects.map((project) => {
      return {
        name: project.name,
        id: project.id,
      };
    });
  }
}
