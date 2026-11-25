%% tietreport.cls
%% LaTeX document class for TIET university reports
%%
%% This class extends the standard 'report' class with
%% customizations for title page, headers, margins,
%% and chapter formatting specific to TIET requirements.
%%
%% Usage:
%%   \documentclass[options]{tietreport}
%%   \TitlePageHeader{...}
%%   \ProjectTitle{...}
%%   ... (configure other variables)
%%   \begin{document}
%%   \maketitle
%%   ...

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{tietreport}[2026/09/03 TIET Report %
  Class v1.0.4]

%% Forward all options to report class
\DeclareOption*{\PassOptionsToClass%
  {\CurrentOption}{report}}
\ProcessOptions\relax

%% Load base report class with standard options
\LoadClass[twoside,12pt,openright]{report}

%% ===================================================
%% Geometry: Page margins and asymmetric layout
%% ===================================================
%% Configure margins for two-sided printing.
%% Inner margin (binding edge) is wider for gutter;
%% outer margins are narrower. Top/bottom margins
%% accommodate headers/footers and content balance.
\RequirePackage[
  inner=1.5in,
  outer=1in,
  top=1.8in,
  bottom=0.85in
]{geometry}

%% ===================================================
%% Fancyhdr: Alternating headers with page numbers
%% ===================================================
%% Left (even) pages: page number + title header.
%% Right (odd) pages: project title + page number.
%% Both placed on outer margin for binding edge
%% clarity. Footer empty to maximize text area.
%% Header rule (0.5pt) provides visual separation.
\RequirePackage{fancyhdr}
\pagestyle{fancy}
\fancyhf{}
\fancyhead[LE]{\thepage \quad \@tpHeader}
\fancyhead[RO]{\@tpTitle \quad \thepage}
\renewcommand{\headrulewidth}{0.5pt}
\renewcommand{\footrulewidth}{0pt}

%% ===================================================
%% Titlesec: Custom chapter title formatting
%% ===================================================
%% Chapter titles use raggedleft (right-aligned)
%% with bold/large label, followed by huge title
%% and horizontal rule. Spacing optimized for
%% visual hierarchy. Chapter opening pages use
%% empty style (no headers).
\RequirePackage{titlesec}
\titleformat{\chapter}[display]
  {\raggedleft\bfseries\large}
  {Chapter \thechapter}
  {0.3em}
  {\huge}
  [\vspace{0.1em}\hrule]
\titlespacing*{\chapter}{0pt}{-50pt}{40pt}
\assignpagestyle{\chapter}{empty}

%% ===================================================
%% Required packages: Hyperref, graphics, math
%% ===================================================
%% Standard packages for links, images, and
%% mathematical notation support.
\RequirePackage{hyperref}
\RequirePackage{graphicx}
\RequirePackage{amsmath}
\RequirePackage{amssymb}

%% ===================================================
%% Internal Variables: Title page content storage
%% ===================================================
%% Prefix @tp denotes "title page" internal vars.
%% These hold configuration set via public commands
%% below. Users should not access these directly.

%% Title page header (e.g., course code and lab)
\newcommand{\@tpHeader}{%
  UCS 503 Software Engineering Project Report%
}

%% Main project title
\newcommand{\@tpTitle}{Proposal to Final}

%% Project subtitle/description
\newcommand{\@tpSubTitle}{%
  How to Write a Project Report%
}

%% Author list (4 students with roll numbers)
\newcommand{\@tpAuthors}{%
  \texttt{102XXXXXXX} {Name Title} \\
  \texttt{102XXXXXXX} {Name Title} \\
  \texttt{102XXXXXXX} {Name Title} \\
  \texttt{102XXXXXXX} {Name Title}%
}

%% Degree, year, group info below authors
\newcommand{\@tpSubText}{%
  Group: \texttt{3XXX} BE Third Year, CSE%
}

%% Faculty advisor/guide name
\newcommand{\@tpAdvisor}{%
  Dr. NAME OF THE ADVISOR%
}

%% Footer: evaluation period, department, institution
\newcommand{\@tpFooter}{%
  \large Mid-Semester Evaluation \\[0.2cm]
  \bfseries Computer Science and Engineering%
  \\ Department \\[0.15cm]
  Thapar Institute of Engineering and%
  \\ Technology, Patiala%
}

%% ===================================================
%% Public Commands: User-facing configuration
%% ===================================================
%% Call these in preamble to customize title page.
%% Example: \TitlePageHeader{CS 504 Lab}

%% Set title page header
\newcommand{\TitlePageHeader}[1]{%
  \renewcommand{\@tpHeader}{#1}%
}

%% Set main project title
\newcommand{\ProjectTitle}[1]{%
  \renewcommand{\@tpTitle}{#1}%
}

%% Set project subtitle
\newcommand{\ProjectSubTitle}[1]{%
  \renewcommand{\@tpSubTitle}{#1}%
}

%% Set author list (override default)
\renewcommand{\author}[1]{%
  \renewcommand{\@tpAuthors}{#1}%
}

%% Set degree/year/group info
\newcommand{\TitlePageSubText}[1]{%
  \renewcommand{\@tpSubText}{#1}%
}

%% Set advisor name
\newcommand{\AdvisorName}[1]{%
  \renewcommand{\@tpAdvisor}{#1}%
}

%% Set footer text (evaluation period, dept, etc)
\newcommand{\TitlePageFooterText}[1]{%
  \renewcommand{\@tpFooter}{#1}%
}

%% ===================================================
%% Maketitle: Render custom title page
%% ===================================================
%% Override \maketitle to produce styled title page
%% using configured variables. Centered layout with
%% institutional branding. After title page, a blank
%% page follows (ready for TOC on next page).

\renewcommand{\maketitle}{%
  \begin{titlepage}
    \thispagestyle{empty}
    \centering
    \vspace*{0.5cm}

    {\large \textbf{\@tpHeader}}

    \vspace{2cm}
    {\LARGE \textbf{\@tpTitle}}

    \vspace{0.2cm}
    {\@tpSubTitle}

    \vspace{3.5cm}
    {\large \textbf{Submitted by:}}

    \vspace{0.2cm}
    {\large \@tpAuthors}

    \vspace{0.5cm}
    {\normalsize \@tpSubText}

    \vfill

    {\large \textbf{Submitted to:}}

    \vspace{0.2cm}
    {\normalsize \@tpAdvisor}

    \vspace{2cm}
    {\normalsize \@tpFooter}
  \end{titlepage}

  \newpage
  \thispagestyle{empty}%
}

\endinput
