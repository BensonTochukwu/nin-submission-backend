import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedAdmin } from '../types/authenticated-admin';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthenticatedAdmin;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Admin is not active');
      }

      request.user = admin;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(value: string | string[] | undefined): string | null {
    const header = Array.isArray(value) ? value[0] : value;
    if (!header) {
      return null;
    }
    const [type, token] = header.split(' ');
    return type?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
